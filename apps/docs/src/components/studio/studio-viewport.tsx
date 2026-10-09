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

import {
  fitRects,
  mostlyOffscreen,
  panBy,
  revealRect,
  screenToWorld,
  stepZoom,
  zoomAt,
} from "../../lib/studio/viewport";
import type { Margins, Point, Rect, Viewport } from "../../lib/studio/viewport";
import { useStudio } from "./studio-state";

/** Screen pixels kept clear around the artboards a fit frames, enough to clear the floating toolbar. */
const FIT_PADDING = 80;

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
  /** Frames one artboard. */
  zoomToArtboard: (id: string, options?: MoveOptions) => void;
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
};

const CommandsContext = createContext<ViewportCommands | undefined>(undefined);
const StateContext = createContext<ViewportState | undefined>(undefined);

const INITIAL_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

/**
 * The camera the canvas draws now. Mid-glide, its registered properties hold the interpolated
 * values, which differ from the glide's destination.
 */
function drawnViewport(canvas: HTMLElement): Viewport | undefined {
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
  const { artboards } = useStudio();
  const canvasRef = useRef<HTMLElement | null>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [gliding, setGliding] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const glideTimer = useRef<number | undefined>(undefined);
  // The camera commands read the newest viewport even between renders, as a pinch sends
  // several moves per frame. Mid-glide it holds the destination; `current` reads the drawn one.
  const latest = useRef(viewport);

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
    window.clearTimeout(glideTimer.current);
    glideTimer.current = undefined;
    setGliding(animate);
    if (animate) {
      glideTimer.current = window.setTimeout(() => {
        glideTimer.current = undefined;
        setGliding(false);
      }, GLIDE_MS);
    }
    latest.current = next;
    setViewport(next);
    if (announce) {
      setAnnouncement(`Zoom ${zoomLabel(next.zoom)}`);
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

  const fit = useCallback(
    (rects: readonly (Rect | undefined)[], options?: MoveOptions) => {
      const next = fitRects(
        rects.filter((rect) => rect !== undefined),
        screen(),
        FIT_PADDING
      );
      if (next !== undefined) {
        move(next, options);
      }
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

  const zoomToArtboard = useCallback(
    (id: string, options?: MoveOptions) => {
      fit([rectOf(id)], options);
    },
    [fit, rectOf]
  );

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
      revealFocus,
    }),
    [centre, current, move, revealFocus, zoomToArtboard, zoomToFit]
  );

  // Each page opens framed. A resize observer reports the canvas's size once it has laid out,
  // before the paint that shows the artboards. `zoomToFit` changes with the page's artboards, so
  // a page switch observes afresh and frames the new page.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return undefined;
    }
    let framed = false;
    const observer = new ResizeObserver(() => {
      if (!framed) {
        framed = true;
        zoomToFit();
      }
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [zoomToFit]);

  // The first fit replaces the initial viewport, and the artboards show from then on.
  const ready = viewport !== INITIAL_VIEWPORT;
  const state = useMemo(
    (): ViewportState => ({ viewport, gliding, ready, announcement }),
    [viewport, gliding, ready, announcement]
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
