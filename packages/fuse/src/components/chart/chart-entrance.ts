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
import type { ChartStore } from "./chart-store";

/** Each waiting plot's reveal, by plot element. */
const reveals = new Map<Element, () => void>();

/** The waiting plots that meet the viewport, which a change of geometry reports on again. */
const near = new Set<Element>();

/** The observer the waiting plots share, which exists while any plot waits. */
let shared: IntersectionObserver | null = null;

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
  for (let node = plot.parentElement; node !== null; node = node.parentElement) {
    if (getComputedStyle(node).overflowY === "visible") continue;
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
      shown.height >= Math.min(boundingClientRect.height / 3, room(target) / 2)
    )
      reveals.get(target)?.();
    else near.add(target);
  }
}

/**
 * Report on every near plot again, as a scroll, a resize of the window or of a plot, or a layout
 * change can show more of one without crossing an observer threshold. Observing a plot anew
 * reports where it stands.
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
 * delays no scroll, as a scroll cannot be cancelled, and a resize listener report again. The
 * last watch to end disconnects the observer and removes both, so a page with no waiting plot
 * spends nothing on the reveal. The result stops watching the plot.
 */
function watch(plot: Element, reveal: () => void): () => void {
  if (shared === null) {
    shared = new IntersectionObserver(decide, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    addEventListener("scroll", reassess, true);
    addEventListener("resize", reassess);
  }
  reveals.set(plot, reveal);
  shared.observe(plot);
  return () => {
    // A watch ends once, however often its Root stops it.
    if (!reveals.delete(plot)) return;
    near.delete(plot);
    shared?.unobserve(plot);
    if (reveals.size > 0) return;
    shared?.disconnect();
    shared = null;
    removeEventListener("scroll", reassess, true);
    removeEventListener("resize", reassess);
  };
}

/**
 * Run Root's entrance. Root's first commit decides it, before any mark places: with the entrance
 * on, the loop holds, Root writes `data-entrance="waiting"`, and the plot is watched until it
 * shows. The reveal waits for the next frame, which a hidden tab never paints, then writes
 * `"played"`, so the CSS wipe and the loop both start in a painted frame, and the plot is no
 * longer watched. The first wipe to end drops the attribute, as every layer's wipe ends in the
 * same frame, so no layer wipes again when the chart is hidden and shown, or takes a new origin,
 * which would start its CSS animation anew. With the entrance off, the marks draw at rest.
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
  store: ChartStore,
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
    };
    const print = (): void => {
      start(null);
    };
    const ended = (event: AnimationEvent): void => {
      if (event.animationName.startsWith("chart-wipe")) writeAttribute(figure, "data-entrance", null);
    };
    addEventListener("beforeprint", print);
    figure.addEventListener("animationend", ended);
    if (!entrance) start(null);
    else if (store.get().phase === "waiting") {
      motion.wait();
      writeAttribute(figure, "data-entrance", "waiting");
      stop = watch(box, () => {
        stop();
        requestAnimationFrame(() => {
          start("played");
        });
      });
    }
    return () => {
      stop();
      removeEventListener("beforeprint", print);
      figure.removeEventListener("animationend", ended);
    };
  }, [store, motion, root, plot, entrance]);
}
