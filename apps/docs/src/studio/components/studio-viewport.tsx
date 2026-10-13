"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";

import { flushSync } from "react-dom";

import {
  fitRects,
  fitWidth,
  mostlyOffscreen,
  panBy,
  revealRect,
  screenToWorld,
  stepZoom,
  zoomAt,
} from "../lib/viewport";
import type { Margins, Point, Rect, Viewport } from "../lib/viewport";
import { useDesktop } from "./studio-desktop";
import { useStudio } from "./studio-state";

/** Screen pixels kept clear around the artboards a fit frames, enough to clear the floating toolbar. */
const FIT_PADDING = 80;

/** Screen pixels the phone's first fit keeps clear: the top clears the artboard's name label. */
const PHONE_FIT_MARGINS = { top: 48, right: 24, left: 24 } as const;

/** How long a programmatic move glides; the canvas transition in globals.css matches it. */
const GLIDE_MS = 280;

/**
 * Screen pixels kept clear around a focused control the camera pans into view. The bottom keeps
 * the fits' clearance, so a control revealed there never lands beneath the floating toolbar.
 */
const REVEAL_MARGINS: Margins = { top: 24, right: 24, bottom: FIT_PADDING, left: 24 };

/** How a camera move happens. */
type MoveOptions = {
  /** Glide there. Direct manipulation never does; reduced motion turns the glide off in CSS. */
  readonly animate?: boolean;
  /** Announce the new zoom, for moves made through a control or a shortcut. */
  readonly announce?: boolean;
};

/** A frame of an artboard waiting for the floating toolbar's answer, told apart by its serial. */
export type FrameRequest = { readonly serial: number; readonly artboardId: string };

/**
 * The floating toolbar's one answer to a frame request: the room its bar over the artboard needs
 * above it, the screen px between the canvas's top and the artboard's top that keep the bar at
 * its gap, or that it shows no bar over the artboard.
 */
export type FrameAnswer =
  | { readonly serial: number; readonly kind: "measured"; readonly px: number }
  | { readonly serial: number; readonly kind: "not-showing" };

type ViewportCommands = {
  /** Attaches the canvas element. Screen points are relative to it. */
  attachCanvas: (element: HTMLElement | null) => void;
  /** The attached canvas element, for event handlers and effects. */
  canvas: () => HTMLElement | null;
  /** Registers an artboard's region, so fits can measure its height. Returns the cleanup. */
  registerArtboard: (id: string, element: HTMLElement) => () => void;
  /** An artboard's registered region, for a keyboard handoff into it. */
  artboardElement: (id: string) => HTMLElement | undefined;
  /** Direct manipulation: pan by a screen delta, or zoom by a factor around a screen point. */
  panBy: (delta: Point) => void;
  zoomAround: (anchor: Point, factor: number) => void;
  /** Zooms to `zoom` around the canvas centre. */
  zoomTo: (zoom: number, options?: MoveOptions) => void;
  zoomStep: (direction: 1 | -1, options?: MoveOptions) => void;
  /** Frames every artboard on the page. */
  zoomToFit: (options?: MoveOptions) => void;
  /** Frames one artboard, with room above it for its floating toolbar once one has shown. */
  zoomToArtboard: (id: string, options?: MoveOptions) => void;
  /** Takes the floating toolbar's answer to the frame request it was given. */
  answerFrame: (answer: FrameAnswer) => void;
  /**
   * Shows a focused element inside an artboard: glides to frame the artboard when it is mostly
   * out of view, and otherwise pans the element into view when the canvas clips it.
   */
  revealFocus: (element: HTMLElement) => void;
};

type ViewportState = {
  viewport: Viewport;
  /** True while a programmatic move glides. */
  gliding: boolean;
  /** True once the first fit has placed the artboards. */
  ready: boolean;
  /** The latest zoom announcement for the canvas's live region. */
  announcement: string;
  /** The latest frame of an artboard, for the floating toolbar to answer (`zoomToArtboard`). */
  frameRequest: FrameRequest | undefined;
};

const CommandsContext = createContext<ViewportCommands | undefined>(undefined);
const StateContext = createContext<ViewportState | undefined>(undefined);

const INITIAL_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

/**
 * The camera the canvas draws now. Mid-glide, its registered properties hold the interpolated
 * values, which differ from the glide's destination.
 */
export function drawnViewport(canvas: HTMLElement): Viewport | undefined {
  const style = getComputedStyle(canvas);
  const zoom = Number.parseFloat(style.getPropertyValue("--studio-zoom"));
  const x = Number.parseFloat(style.getPropertyValue("--studio-pan-x"));
  const y = Number.parseFloat(style.getPropertyValue("--studio-pan-y"));
  return Number.isFinite(zoom) && Number.isFinite(x) && Number.isFinite(y) ? { x, y, zoom } : undefined;
}

export function zoomLabel(zoom: number): string {
  return `${String(Math.round(zoom * 100))}%`;
}

/**
 * Owns the canvas camera for the studio layout, so the top bar's zoom menu, the Layers list and
 * the canvas share one viewport. Commands and state are separate contexts: the Layers list and
 * the artboards never re-render while the canvas pans.
 */
export function ViewportProvider({ children }: { children: ReactNode }): ReactElement {
  const { artboards, selectedId } = useStudio();
  const desktop = useDesktop();
  const canvasRef = useRef<HTMLElement | null>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [gliding, setGliding] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const glideTimer = useRef<number | undefined>(undefined);
  // The camera commands read the newest viewport even between renders, as a pinch sends
  // several moves per frame. Mid-glide it holds the destination; `current` reads the drawn one.
  const latest = useRef(viewport);
  // The room the floating toolbar last measured above an artboard, and the frame request waiting
  // for its answer (`zoomToArtboard`).
  const toolbarRoom = useRef<number | undefined>(undefined);
  const serials = useRef(0);
  const [frameRequest, setFrameRequest] = useState<FrameRequest | undefined>(undefined);
  const pending = useRef<
    (FrameRequest & { readonly top: number; readonly options: MoveOptions | undefined }) | undefined
  >(undefined);

  const screen = useCallback(() => {
    const canvas = canvasRef.current;
    return { width: canvas?.clientWidth ?? 0, height: canvas?.clientHeight ?? 0 };
  }, []);

  const rectOf = useCallback(
    (id: string): Rect | undefined => {
      const spec = artboards.find((artboard) => artboard.id === id);
      const element = elements.current.get(id);
      if (spec === undefined || element === undefined) {
        return undefined;
      }
      return { x: spec.x, y: spec.y, width: spec.width, height: element.offsetHeight };
    },
    [artboards]
  );

  const move = useCallback((next: Viewport, { animate = false, announce = false }: MoveOptions = {}) => {
    pending.current = undefined;
    // A move that interrupts a glide commits inside its event. A native wheel listener's update
    // is otherwise scheduled, and the glide plays on until that commit cancels it, then snaps.
    const interrupts = glideTimer.current !== undefined && !animate;
    window.clearTimeout(glideTimer.current);
    glideTimer.current = undefined;
    if (animate) {
      glideTimer.current = window.setTimeout(() => {
        glideTimer.current = undefined;
        setGliding(false);
      }, GLIDE_MS);
    }
    latest.current = next;
    const commit = () => {
      setGliding(animate);
      setViewport(next);
      if (announce) {
        setAnnouncement(`Zoom ${zoomLabel(next.zoom)}`);
      }
    };
    if (interrupts) {
      flushSync(commit);
    } else {
      commit();
    }
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(glideTimer.current);
    },
    []
  );

  // Dropping `data-gliding` does not stop Chrome's running transitions on the registered camera
  // properties; they run on to the old destination over the new camera. They are cancelled in the
  // commit that ends the glide, before its paint.
  useLayoutEffect(() => {
    if (gliding) {
      return;
    }
    for (const animation of canvasRef.current?.getAnimations() ?? []) {
      if (animation instanceof CSSTransition && animation.transitionProperty.startsWith("--studio-")) {
        animation.cancel();
      }
    }
  }, [gliding, viewport]);

  /**
   * The camera direct manipulation starts from. A drag, wheel or pinch that interrupts a glide
   * commits the camera the canvas draws at that instant, then moves from it; the move drops the
   * transition, so the world continues from where it was seen. Sampling the drawn camera keeps
   * the glide in CSS, where Fuse's central reduced-motion rule owns it.
   */
  const current = useCallback((): Viewport => {
    const canvas = canvasRef.current;
    if (glideTimer.current !== undefined && canvas !== null) {
      latest.current = drawnViewport(canvas) ?? latest.current;
    }
    return latest.current;
  }, []);

  /**
   * Moves the camera to show every rect, `top` screen px below the screen's top, the fit padding
   * by default.
   *
   * @returns Whether it moved: not when there is nothing to fit.
   */
  const fit = useCallback(
    (rects: readonly (Rect | undefined)[], options?: MoveOptions, top?: number): boolean => {
      const next = fitRects(
        rects.filter((rect) => rect !== undefined),
        screen(),
        FIT_PADDING,
        top
      );
      if (next === undefined) {
        return false;
      }
      move(next, options);
      return true;
    },
    [move, screen]
  );

  const zoomToFit = useCallback(
    (options?: MoveOptions) => {
      fit(
        artboards.map((artboard) => rectOf(artboard.id)),
        options
      );
    },
    [artboards, fit, rectOf]
  );

  const frameArtboard = useCallback(
    (id: string, top: number, options: MoveOptions | undefined): boolean => fit([rectOf(id)], options, top),
    [fit, rectOf]
  );

  // A Layers pick or zoom to selection frames the artboard with room above it for the floating
  // toolbar. The pick selects and frames in one click, before the toolbar for the new selection
  // has rendered, so the frame reserves the room the toolbar last measured and becomes a request
  // with a serial, published in the viewport state. On the commit that follows, the toolbar
  // answers it once, whatever it shows: the measured room when its bar sits over the artboard,
  // its first and real height as the studio caps its width, and otherwise that it shows none
  // there. A taller bar frames the artboard once more with its own room. Either answer ends the
  // request, as do any other camera move and a selection change, so no request waits on a bar
  // that will not render, and the camera moves only when the visitor has just asked for a frame.
  // Below `lg` no toolbar renders, and a frame requests nothing.
  const zoomToArtboard = useCallback(
    (id: string, options?: MoveOptions) => {
      const top = desktop ? Math.max(FIT_PADDING, toolbarRoom.current ?? 0) : FIT_PADDING;
      if (!frameArtboard(id, top, options) || !desktop) {
        return;
      }
      serials.current += 1;
      const request: FrameRequest = { serial: serials.current, artboardId: id };
      pending.current = { ...request, top, options };
      setFrameRequest(request);
    },
    [desktop, frameArtboard]
  );

  const answerFrame = useCallback(
    (answer: FrameAnswer) => {
      if (answer.kind === "measured") {
        toolbarRoom.current = answer.px;
      }
      const waiting = pending.current;
      if (waiting?.serial !== answer.serial) {
        return;
      }
      pending.current = undefined;
      if (answer.kind === "measured" && answer.px > waiting.top) {
        frameArtboard(waiting.artboardId, answer.px, waiting.options);
      }
    },
    [frameArtboard]
  );

  // A selection change ends a request to frame another artboard.
  useEffect(() => {
    if (pending.current?.artboardId !== selectedId) {
      pending.current = undefined;
    }
  }, [selectedId]);

  const revealFocus = useCallback(
    (element: HTMLElement) => {
      const id = element.closest<HTMLElement>("[data-artboard-id]")?.dataset.artboardId;
      const rect = id === undefined ? undefined : rectOf(id);
      const canvas = canvasRef.current;
      if (id === undefined || rect === undefined || canvas === null) {
        return;
      }
      if (mostlyOffscreen(latest.current, rect, screen())) {
        fit([rect], { animate: true });
        return;
      }
      // The artboard itself, focused by a click or the Layers handoff, keeps its framing.
      if (element === elements.current.get(id)) {
        return;
      }
      // The element is measured where the canvas draws it, which mid-glide is not the glide's
      // destination, and before the canvas's native focus scroll is undone.
      const drawn = drawnViewport(canvas) ?? latest.current;
      const box = element.getBoundingClientRect();
      const frame = canvas.getBoundingClientRect();
      const topLeft = screenToWorld(drawn, {
        x: box.left - frame.left + canvas.scrollLeft,
        y: box.top - frame.top + canvas.scrollTop,
      });
      const world = { ...topLeft, width: box.width / drawn.zoom, height: box.height / drawn.zoom };
      const next = revealRect(latest.current, world, screen(), REVEAL_MARGINS);
      if (next.x !== latest.current.x || next.y !== latest.current.y) {
        move(next, { animate: true });
      }
    },
    [fit, move, rectOf, screen]
  );

  const centre = useCallback((): Point => {
    const { width, height } = screen();
    return { x: width / 2, y: height / 2 };
  }, [screen]);

  const commands = useMemo(
    (): ViewportCommands => ({
      attachCanvas: (element) => {
        canvasRef.current = element;
      },
      canvas: () => canvasRef.current,
      registerArtboard: (id, element) => {
        elements.current.set(id, element);
        return () => {
          if (elements.current.get(id) === element) {
            elements.current.delete(id);
          }
        };
      },
      artboardElement: (id) => elements.current.get(id),
      panBy: (delta) => {
        move(panBy(current(), delta));
      },
      zoomAround: (anchor, factor) => {
        const from = current();
        move(zoomAt(from, anchor, from.zoom * factor));
      },
      zoomTo: (zoom, options) => {
        move(zoomAt(latest.current, centre(), zoom), options);
      },
      zoomStep: (direction, options) => {
        move(zoomAt(latest.current, centre(), stepZoom(latest.current.zoom, direction)), options);
      },
      zoomToFit,
      zoomToArtboard,
      answerFrame,
      revealFocus,
    }),
    [answerFrame, centre, current, move, revealFocus, zoomToArtboard, zoomToFit]
  );

  // Each page opens framed. A resize observer reports the canvas's size once it has laid out,
  // before the paint that shows the artboards. `zoomToFit` changes with the page's artboards, so
  // a page switch observes afresh and frames the new page.
  // Every artboard at once on a phone is a thumbnail band, so there the first fit frames the
  // first artboard across the screen instead. The canvas's CSS names the fit, which keeps the
  // breakpoint with the layout's own.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return undefined;
    }
    let framed = false;
    const observer = new ResizeObserver(() => {
      if (framed) {
        return;
      }
      framed = true;
      const first = artboards[0] === undefined ? undefined : rectOf(artboards[0].id);
      if (
        first !== undefined &&
        getComputedStyle(canvas).getPropertyValue("--studio-first-fit").trim() === "artboard"
      ) {
        move(fitWidth(first, screen(), PHONE_FIT_MARGINS));
      } else {
        zoomToFit();
      }
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [artboards, move, rectOf, screen, zoomToFit]);

  // The first fit replaces the initial viewport, and the artboards show from then on.
  const ready = viewport !== INITIAL_VIEWPORT;
  const state = useMemo(
    (): ViewportState => ({ viewport, gliding, ready, announcement, frameRequest }),
    [viewport, gliding, ready, announcement, frameRequest]
  );

  return (
    <CommandsContext.Provider value={commands}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </CommandsContext.Provider>
  );
}

export function useViewportCommands(): ViewportCommands {
  const value = use(CommandsContext);
  if (value === undefined) {
    throw new Error("useViewportCommands must be used within ViewportProvider");
  }
  return value;
}

export function useViewportState(): ViewportState {
  const value = use(StateContext);
  if (value === undefined) {
    throw new Error("useViewportState must be used within ViewportProvider");
  }
  return value;
}
