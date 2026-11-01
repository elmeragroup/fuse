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

/** The waiting plots that meet the viewport, which every scroll reports on again. */
const near = new Set<Element>();

/** The one observer every waiting plot shares, created for the first. */
let shared: IntersectionObserver | null = null;

/**
 * The most of its height a plot can show at once: the viewport's height, or less inside an
 * ancestor that clips it, as a scroll container does.
 */
function room(plot: Element): number {
  let height = innerHeight;
  for (let node = plot.parentElement; node !== null; node = node.parentElement) {
    if (getComputedStyle(node).overflowY !== "visible") height = Math.min(height, node.clientHeight);
  }
  return height;
}

/**
 * Watch a plot until it shows enough of itself to play the entrance, then call its reveal. A plot
 * shows enough once any of its width and a third of its height show, or half the height it can
 * show at most, which a tall plot, or one in a short scroll container, reaches first. Both read
 * the visible height, never the visible area, so a wide plot in a narrow scroller reveals too, and
 * a plot at the end of the page that cannot scroll further shows all it can. Visibility can grow
 * without crossing an observer threshold, so every scroll, the page's or a container's, observes
 * the near plots again, which reports where each stands. The result stops watching the plot.
 */
function watch(plot: Element, reveal: () => void): () => void {
  if (shared === null) {
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting, intersectionRect: shown, boundingClientRect } of entries) {
        if (!isIntersecting) near.delete(target);
        else if (shown.width > 0 && shown.height >= Math.min(boundingClientRect.height / 3, room(target) / 2))
          reveals.get(target)?.();
        else near.add(target);
      }
    });
    // A scroll cannot be cancelled, so the capturing listener never delays one.
    addEventListener(
      "scroll",
      () => {
        for (const each of near) {
          observer.unobserve(each);
          observer.observe(each);
        }
      },
      true
    );
    shared = observer;
  }
  reveals.set(plot, reveal);
  shared.observe(plot);
  return () => {
    reveals.delete(plot);
    near.delete(plot);
    shared?.unobserve(plot);
  };
}

/**
 * Run Root's entrance. Root's first commit decides it, before any mark places: with the entrance
 * on, the loop holds, Root writes `data-entrance="waiting"`, and the plot is watched until it
 * shows. The reveal waits for the next frame, which a hidden tab never paints, then writes
 * `"played"`, so the CSS wipe and the loop both start in a painted frame, and the plot is no
 * longer watched. With the entrance off, the marks draw at rest. Turning it off later, as
 * `data-intro="none"` or reduced motion does, draws them at rest and drops the attribute, which
 * ends the CSS wipe whether it waits, runs or has played, and the entrance stays spent, so turning
 * it on again replays nothing. A print draws every mark at rest the same way.
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
    addEventListener("beforeprint", print);
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
    };
  }, [store, motion, root, plot, entrance]);
}
