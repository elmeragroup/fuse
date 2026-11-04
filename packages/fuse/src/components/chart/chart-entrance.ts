"use client";

/**
 * Root's entrance, which plays once, the first time its plot comes into view, whether Root
 * hydrated server HTML or mounted in the browser. Until then Root writes `data-entrance="waiting"`,
 * which holds the CSS wipe of lines, areas and dots at its first frame, and holds the motion loop,
 * so bars wait at their base and no frame runs. One IntersectionObserver watches every waiting
 * plot, as one ResizeObserver measures every plot. Reduced motion, `data-intro="none"` and a print
 * draw the marks at rest at once, and end an entrance that runs.
 */
import { useLayoutEffect } from "react";
import type { RefObject } from "react";

import { writeAttribute } from "./chart-dom";
import type { ChartMotion } from "./chart-motion";
import type { EntrancePhase } from "./chart-store";

/** What the entrance reads and moves on a Root's store: its phase alone. */
export type EntranceStore = {
  readonly get: () => { readonly phase: EntrancePhase };
  readonly set: (patch: { readonly phase: EntrancePhase }) => void;
};

/** Each waiting plot's reveal, by plot element. */
const reveals = new Map<Element, () => void>();

/** The waiting plots that meet the viewport, which a change of geometry reports on again. */
const near = new Set<Element>();

/** The observer the waiting plots share, which exists while any plot waits. */
let shared: IntersectionObserver | null = null;

/** The observer of the waiting plots' clipping ancestors, which exists with `shared`. */
let clippers: ResizeObserver | null = null;

/** How many waiting plots each observed clipping ancestor clips. */
const clipping = new Map<Element, number>();

/** The ancestors that clip a plot, as a scroll container does, nearest first. */
function clippersOf(plot: Element): Element[] {
  const found: Element[] = [];
  for (let node = plot.parentElement; node !== null; node = node.parentElement) {
    if (getComputedStyle(node).overflowY !== "visible") found.push(node);
  }
  return found;
}

/**
 * The most of its height a plot can show at once: the height where every ancestor that clips it,
 * as a scroll container does, overlaps the others, and no more than the viewport's. Each box is
 * read in viewport coordinates, so where one clipper sits inside another and how either is
 * transformed count, as they do for the observer. The viewport bounds the height without cutting
 * it by position, since the page scrolls a clipper that enters at the viewport's edge into view,
 * and a chart in a card that clips would otherwise reveal as its first sliver shows.
 */
function room(plot: Element): number {
  let top = Number.NEGATIVE_INFINITY;
  let bottom = Number.POSITIVE_INFINITY;
  for (const node of clippersOf(plot)) {
    const box = node.getBoundingClientRect();
    top = Math.max(top, box.top);
    bottom = Math.min(bottom, box.bottom);
  }
  return Math.max(0, Math.min(bottom - top, innerHeight));
}

/**
 * The reveal decision for every waiting plot. A plot plays its entrance once any of its width and a
 * third of its height show, or half the height it can show at most, which a tall plot, or one in a
 * short scroll container, reaches first. Some of its height must show, so a plot that only touches
 * the edge of a collapsed container, which the observer counts as meeting it, waits. Both read the
 * visible height, never the visible area, so a wide plot in a narrow scroller reveals too, and a
 * plot at the end of the page that cannot scroll further shows all it can. A plot that meets the
 * viewport and shows too little stays near, for the next change of geometry to report on.
 */
function decide(entries: readonly IntersectionObserverEntry[]): void {
  for (const { target, isIntersecting, intersectionRect: shown, boundingClientRect } of entries) {
    if (!isIntersecting) near.delete(target);
    else if (
      Math.min(shown.width, shown.height) > 0 &&
      (shown.height >= boundingClientRect.height / 3 || shown.height >= room(target) / 2)
    )
      reveals.get(target)?.();
    else near.add(target);
  }
}

/**
 * Report on every near plot again, as a scroll, a resize of the window, of a plot or of an
 * ancestor that clips one, or a layout change can show more of one without crossing an observer
 * threshold. Observing a plot anew reports where it stands.
 */
export function reassess(): void {
  for (const plot of near) {
    shared?.unobserve(plot);
    shared?.observe(plot);
  }
}

/**
 * Watch a plot until it shows enough of itself, then call its reveal. The observer reports each
 * quarter of a plot it crosses, and while any plot waits a capturing scroll listener, which
 * delays no scroll, as a scroll cannot be cancelled, a resize listener and a ResizeObserver on
 * the ancestors that clip a waiting plot report again, since a clipper that grows, its padding
 * alone included, shows more of its plot and moves neither the plot nor the window. Each clipper is observed while any plot it
 * clips waits. The last watch to end disconnects both observers and removes the listeners, so a
 * page with no waiting plot spends nothing on the reveal. The result stops watching the plot.
 */
function watch(plot: Element, reveal: () => void): () => void {
  if (shared === null || clippers === null) {
    shared = new IntersectionObserver(decide, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    clippers = new ResizeObserver(reassess);
    addEventListener("scroll", reassess, true);
    addEventListener("resize", reassess);
  }
  reveals.set(plot, reveal);
  shared.observe(plot);
  const clipped = clippersOf(plot);
  for (const node of clipped) {
    const count = clipping.get(node) ?? 0;
    clipping.set(node, count + 1);
    // Overflow clips at the padding box, so padding that grows shows more of the plot.
    if (count === 0) clippers.observe(node, { box: "border-box" });
  }
  return () => {
    // A watch ends once, however often its Root stops it.
    if (!reveals.delete(plot)) return;
    near.delete(plot);
    shared?.unobserve(plot);
    for (const node of clipped) {
      const count = (clipping.get(node) ?? 1) - 1;
      if (count > 0) clipping.set(node, count);
      else {
        clipping.delete(node);
        clippers?.unobserve(node);
      }
    }
    if (reveals.size > 0) return;
    shared?.disconnect();
    clippers?.disconnect();
    shared = null;
    clippers = null;
    removeEventListener("scroll", reassess, true);
    removeEventListener("resize", reassess);
  };
}

/** Whether an animation is the entrance's CSS wipe of a line, an area or dots. */
function isWipe(name: string): boolean {
  return name.startsWith("chart-wipe");
}

/**
 * Run Root's entrance. Root's first commit decides it, before any mark places: with the entrance
 * on, the loop holds, Root writes `data-entrance="waiting"`, and the plot is watched until it
 * shows. The reveal waits for the next frame, which a hidden tab never paints, then writes
 * `"played"`, so the CSS wipe and the loop both start in a painted frame, and the plot is no
 * longer watched. A reveal whose effect ends before that frame cancels the frame, so the entrance
 * is never spent unseen, and a Root that comes back still waiting watches again. The first wipe to
 * end or be cancelled, as hiding the chart mid-wipe does, drops the attribute, as every layer's
 * wipe ends in the same frame, and a chart with no layer to wipe, such as one of bars alone, drops
 * it as it writes it. The effect's cleanup drops a `"played"` attribute too, since React Activity
 * runs it before hiding the chart, so the cancel that hiding fires reaches no listener, and the
 * effect that runs on show finds the entrance started. So no layer wipes again or wipes in later
 * when the chart is hidden and shown, takes a new origin, which would start its CSS animation
 * anew, or gains a line or an area. A cancel or a cleanup while the entrance waits leaves it
 * waiting, so a Root that comes back watches again. With the entrance off, the marks draw at rest.
 * Turning it off later, as `data-intro="none"` or reduced motion does, draws them at rest and drops
 * the attribute, which ends the CSS wipe whether it waits, runs or has played, and the entrance
 * stays spent, so turning it on again replays nothing. A print draws every mark at rest the same
 * way.
 *
 * @param store - The Root's store, whose phase marks read as they draw.
 * @param motion - The Root's loop.
 * @param root - Root's figure.
 * @param plot - Root's plot, which the observer watches.
 * @param entrance - Whether Root has an entrance: `data-intro` is not "none" and the reader allows
 *   motion.
 */
export function useEntrance(
  store: EntranceStore,
  motion: ChartMotion,
  root: RefObject<HTMLElement | null>,
  plot: RefObject<HTMLElement | null>,
  entrance: boolean
): void {
  useLayoutEffect(() => {
    const figure = root.current;
    const box = plot.current;
    if (figure === null || box === null) return undefined;
    let stop = (): void => undefined;
    /**
     * Play the entrance once, as `"played"` says, or with null draw every mark at rest, which also
     * ends an entrance that runs, and drops the wipe with the attribute.
     */
    const start = (entered: "played" | null): void => {
      stop();
      if (entered === null) motion.finish();
      else if (store.get().phase === "started") return;
      writeAttribute(figure, "data-entrance", entered);
      store.set({ phase: "started" });
      motion.play();
      if (entered === null) return;
      // Reading the animations applies the attribute's styles first.
      const wiping = figure
        .getAnimations({ subtree: true })
        .some((animation) => animation instanceof CSSAnimation && isWipe(animation.animationName));
      if (!wiping) writeAttribute(figure, "data-entrance", null);
    };
    const print = (): void => {
      start(null);
    };
    const ended = (event: AnimationEvent): void => {
      if (isWipe(event.animationName) && figure.getAttribute("data-entrance") === "played")
        writeAttribute(figure, "data-entrance", null);
    };
    let frame = 0;
    addEventListener("beforeprint", print);
    figure.addEventListener("animationend", ended);
    figure.addEventListener("animationcancel", ended);
    if (!entrance) start(null);
    else if (store.get().phase === "waiting") {
      motion.wait();
      writeAttribute(figure, "data-entrance", "waiting");
      stop = watch(box, () => {
        stop();
        frame = requestAnimationFrame(() => {
          start("played");
        });
      });
    }
    return () => {
      stop();
      cancelAnimationFrame(frame);
      removeEventListener("beforeprint", print);
      figure.removeEventListener("animationend", ended);
      figure.removeEventListener("animationcancel", ended);
      // React Activity runs this before it hides the figure, so the cancel reaches no listener.
      if (figure.getAttribute("data-entrance") === "played") writeAttribute(figure, "data-entrance", null);
    };
  }, [store, motion, root, plot, entrance]);
}
