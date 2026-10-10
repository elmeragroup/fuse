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

import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";

import { FUSE_PART_ROLES, resolvePartRole } from "../lib/density-parts";
import type { PartRole } from "../lib/density-parts";
import { nearestSlot } from "../lib/slot-tokens";
import { ChromeScope } from "./chrome-scope";
import { useStudio } from "./studio-state";
import { useViewportState } from "./studio-viewport";

const studioPartSelection = tv({
  slots: {
    overlay: "pointer-events-none absolute inset-0 z-20 overflow-hidden",
    // The part's border box in screen px, outlined at one screen width whatever the zoom.
    outline:
      "absolute top-(--part-y) left-(--part-x) h-(--part-h) w-(--part-w) outline-2 -outline-offset-1 outline-primary",
    tag: "absolute bottom-full left-0 mb-1 font-mono whitespace-nowrap",
  },
});

const styles = studioPartSelection();

/** A part picked on the canvas: its slot, the artboard it renders in, and its element. */
export type PickedPart = {
  readonly artboard: string;
  readonly slot: string;
  readonly element: HTMLElement;
};

/** A length per side, in CSS px. */
export type Sides = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

/** The picked part as measured off the page, in CSS px whatever the zoom. */
export type PartMetrics = {
  /** Its border-box size. */
  readonly width: number;
  readonly height: number;
  readonly padding: Sides;
  readonly border: Sides;
  readonly radius: number;
  /** Its density role as `PART_DENSITY` declares it, or `undefined` for an undeclared slot. */
  readonly role: PartRole | undefined;
};

/** The picked part's identity and the commands on it, stable while the part stays picked. */
type PartSelectionValue = {
  /** The picked part, while its artboard stays selected. */
  part: PickedPart | undefined;
  /**
   * Picks the part at or above `target`, the nearest element with a `data-slot` inside an
   * artboard, and selects its artboard. Returns whether `target` sits in an artboard.
   */
  pick: (target: Element) => boolean;
  /** Drops the picked part, keeping its artboard selected. */
  clear: () => void;
  /** "Select part" mode: a plain press picks a part instead of using it. */
  partMode: boolean;
  setPartMode: (on: boolean) => void;
  /**
   * Calls `listener` whenever the picked part may have moved or changed inside its artboard:
   * a mutation, a resize, or each frame of a transition or animation. Returns the unsubscribe.
   */
  watch: (listener: () => void) => () => void;
};

const PartSelectionContext = createContext<PartSelectionValue | undefined>(undefined);
const PartMetricsContext = createContext<PartMetrics | undefined>(undefined);

/** The artboard surface a part renders in: its theme scope, overlays portalled into it included. */
const STAGE = "[data-demo-stage]";
const ARTBOARD = "[data-artboard-id]";
const CANVAS = "[data-studio-canvas]";

const MOTION_EVENTS = [
  "transitionrun",
  "animationstart",
  "transitionend",
  "transitioncancel",
  "animationend",
  "animationcancel",
] as const;

function sides(style: CSSStyleDeclaration, property: (side: string) => string): Sides {
  const read = (side: string) => Number.parseFloat(style.getPropertyValue(property(side))) || 0;
  return { top: read("top"), right: read("right"), bottom: read("bottom"), left: read("left") };
}

function measure({ slot, element }: PickedPart): PartMetrics {
  const style = getComputedStyle(element);
  return {
    width: element.offsetWidth,
    height: element.offsetHeight,
    padding: sides(style, (side) => `padding-${side}`),
    border: sides(style, (side) => `border-${side}-width`),
    radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
    role: resolvePartRole(FUSE_PART_ROLES, slot, (suffix) =>
      element.matches(`[data-slot="${slot}"]${suffix}`)
    ),
  };
}

/**
 * Owns the part the visitor picked on the canvas, with the Select tool and Alt or "Select part"
 * mode. A part belongs to its artboard's selection: selecting another artboard, a page switch,
 * Escape or its element leaving the page clears it.
 *
 * Nothing is read while the page is idle. The inspector's metrics are measured again when the
 * part's artboard mutates, such as an edit restyling it, the part resizes or a web font loads,
 * and per frame only while a transition or animation runs in an artboard. The outline follows the
 * same changes and the camera on its own, so a pan re-renders neither the canvas nor the inspector.
 */
export function PartSelectionProvider({ children }: { children: ReactNode }): ReactElement {
  const { selectedId, select } = useStudio();
  const [picked, setPicked] = useState<PickedPart | undefined>(undefined);
  const [metrics, setMetrics] = useState<PartMetrics | undefined>(undefined);
  const [partMode, setPartMode] = useState(false);
  const [listeners] = useState(() => new Set<() => void>());
  const part = picked?.artboard === selectedId ? picked : undefined;
  if (picked !== undefined && part === undefined) {
    setPicked(undefined);
  }

  const pick = useCallback(
    (target: Element) => {
      const stage = target.closest<HTMLElement>(STAGE);
      const artboard = stage?.closest<HTMLElement>(ARTBOARD)?.dataset.artboardId;
      if (stage === null || artboard === undefined) {
        return false;
      }
      // An icon's SVG carries no slot; the chain starts at the HTML element around it.
      const chain: HTMLElement[] = [];
      for (let element: Element | null = target; element !== null && element !== stage;) {
        if (element instanceof HTMLElement) {
          chain.push(element);
        }
        element = element.parentElement;
      }
      const nearest = nearestSlot(chain.map((element) => element.dataset.slot));
      const element = nearest === undefined ? undefined : chain[nearest.index];
      select(artboard);
      setPicked(
        nearest === undefined || element === undefined ? undefined : { artboard, slot: nearest.slot, element }
      );
      return true;
    },
    [select]
  );

  const watch = useCallback(
    (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    [listeners]
  );

  useEffect(() => {
    const host = part?.element.closest(CANVAS);
    if (part === undefined || host === null || host === undefined) {
      return undefined;
    }
    let last = "";
    let request = 0;
    const inArtboard = (node: Node) =>
      ((node instanceof Element ? node : node.parentElement)?.closest(ARTBOARD) ?? null) !== null;
    // Read from the live list, so a transition or keyframe animation that began before the pick
    // counts as much as one that begins after it.
    const moving = () =>
      host
        .getAnimations({ subtree: true })
        .some(
          (animation) =>
            animation.playState === "running" &&
            animation.effect instanceof KeyframeEffect &&
            animation.effect.target !== null &&
            inArtboard(animation.effect.target)
        );
    const update = () => {
      request = 0;
      if (!part.element.isConnected) {
        setPicked(undefined);
        return;
      }
      const next = measure(part);
      const signature = JSON.stringify(next);
      if (signature !== last) {
        last = signature;
        setMetrics(next);
      }
      for (const listener of listeners) {
        listener();
      }
      if (moving()) {
        request = requestAnimationFrame(update);
      }
    };
    const schedule = () => {
      if (request === 0) {
        request = requestAnimationFrame(update);
      }
    };
    // The camera's own properties on the canvas are the outline's business, not the part's.
    const mutations = new MutationObserver((records) => {
      if (!part.element.isConnected || records.some((record) => inArtboard(record.target))) {
        schedule();
      }
    });
    mutations.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
    const resizes = new ResizeObserver(schedule);
    resizes.observe(part.element);
    // A start begins the frame loop, and an end or a cancel reads the final values.
    const onMotion = (event: Event) => {
      if (event.target instanceof Element && inArtboard(event.target)) {
        schedule();
      }
    };
    // Scroll events do not bubble; capturing sees a list or a dialog body scrolling the part.
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && inArtboard(event.target)) {
        schedule();
      }
    };
    for (const type of MOTION_EVENTS) {
      host.addEventListener(type, onMotion);
    }
    host.addEventListener("scroll", onScroll, { capture: true });
    // A web font that finishes loading reflows the part without touching the artboard's DOM.
    document.fonts.addEventListener("loadingdone", schedule);
    update();
    return () => {
      cancelAnimationFrame(request);
      mutations.disconnect();
      resizes.disconnect();
      for (const type of MOTION_EVENTS) {
        host.removeEventListener(type, onMotion);
      }
      host.removeEventListener("scroll", onScroll, { capture: true });
      document.fonts.removeEventListener("loadingdone", schedule);
      setMetrics(undefined);
    };
  }, [part, listeners]);

  const clear = useCallback(() => {
    setPicked(undefined);
  }, []);

  const value = useMemo(
    (): PartSelectionValue => ({ part, pick, clear, partMode, setPartMode, watch }),
    [part, pick, clear, partMode, watch]
  );
  return (
    <PartSelectionContext value={value}>
      <PartMetricsContext value={metrics}>{children}</PartMetricsContext>
    </PartSelectionContext>
  );
}

export function usePartSelection(): PartSelectionValue {
  const value = use(PartSelectionContext);
  if (value === undefined) {
    throw new Error("usePartSelection must be used within PartSelectionProvider");
  }
  return value;
}

/** The picked part's metrics, once measured; they change only when the part does. */
export function usePartMetrics(): PartMetrics | undefined {
  return use(PartMetricsContext);
}

function px(value: number): string {
  return `${String(value)}px`;
}

/**
 * The picked part's outline and slot tag, in screen space over the canvas, so the line keeps one
 * screen width at any zoom. It writes its box straight to its element: when the camera moves,
 * every frame of a glide, and when the part may have changed. Screen readers get the
 * inspector's Selection section.
 */
export function PartOutline(): ReactElement | null {
  const { part, watch } = usePartSelection();
  const { viewport, gliding } = useViewportState();
  const box = useRef<HTMLDivElement>(null);
  const schedule = useRef<() => void>(() => undefined);
  const glidingNow = useRef(gliding);

  useLayoutEffect(() => {
    const outline = box.current;
    const host = part?.element.closest(CANVAS);
    if (part === undefined || outline === null || host === null || host === undefined) {
      return undefined;
    }
    let request = 0;
    let last = "";
    const draw = () => {
      request = 0;
      const origin = host.getBoundingClientRect();
      const rect = part.element.getBoundingClientRect();
      const place = [rect.left - origin.left, rect.top - origin.top, rect.width, rect.height];
      const signature = place.join(" ");
      if (signature !== last) {
        last = signature;
        const [x = 0, y = 0, width = 0, height = 0] = place;
        outline.style.setProperty("--part-x", px(x));
        outline.style.setProperty("--part-y", px(y));
        outline.style.setProperty("--part-w", px(width));
        outline.style.setProperty("--part-h", px(height));
      }
      if (glidingNow.current) {
        request = requestAnimationFrame(draw);
      }
    };
    const requestDraw = () => {
      if (request === 0) {
        request = requestAnimationFrame(draw);
      }
    };
    schedule.current = requestDraw;
    // Part changes request a frame rather than draw, so a glide's loop never gains a second one.
    const unwatch = watch(requestDraw);
    draw();
    return () => {
      schedule.current = () => undefined;
      cancelAnimationFrame(request);
      unwatch();
    };
  }, [part, watch]);

  // A camera move draws once; a glide draws every frame until it lands.
  useEffect(() => {
    glidingNow.current = gliding;
    schedule.current();
  }, [viewport, gliding]);

  if (part === undefined) {
    return null;
  }
  return (
    <ChromeScope aria-hidden className={styles.overlay()} data-part-outline>
      <div ref={box} className={styles.outline()}>
        <Badge size="sm" className={styles.tag()}>
          {part.slot}
        </Badge>
      </div>
    </ChromeScope>
  );
}
