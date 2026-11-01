"use client";

/**
 * Root's entrance, which plays once, the first time its plot comes into view, whether Root
 * hydrated server HTML or mounted in the browser. Until then Root writes `data-entrance="waiting"`,
 * which holds the CSS wipe of lines, areas and dots at its first frame, and holds the motion loop,
 * so bars wait at their base and no frame runs. One IntersectionObserver watches every waiting
 * plot, as one ResizeObserver measures every plot. Reduced motion, `data-intro="none"` and a print
 * draw the marks at rest at once.
 */
import { useLayoutEffect } from "react";
import type { RefObject } from "react";

import { writeAttribute } from "./chart-dom";
import type { ChartMotion } from "./chart-motion";
import type { ChartStore } from "./chart-store";

/** Each waiting plot's reveal, by plot element. */
const reveals = new Map<Element, () => void>();

/** The one observer every waiting plot shares, created for the first. */
let shared: IntersectionObserver | null = null;

/**
 * Watch a plot until it shows enough of itself to play the entrance, then call its reveal: a third
 * of the plot, or half the viewport's height, which a plot over one and a half viewports tall
 * reaches first. The result stops watching it.
 */
function watch(plot: Element, reveal: () => void): () => void {
  shared ??= new IntersectionObserver(
    (entries) => {
      for (const { target, intersectionRatio, intersectionRect, rootBounds } of entries) {
        if (intersectionRatio >= 1 / 3 || intersectionRect.height >= (rootBounds?.height ?? innerHeight) / 2)
          reveals.get(target)?.();
      }
    },
    // Every thirtieth up to a third of the plot, so a tall plot that covers half the viewport at a
    // smaller share reports within a thirtieth of its height of it.
    { threshold: Array.from({ length: 11 }, (_, step) => step / 30) }
  );
  reveals.set(plot, reveal);
  shared.observe(plot);
  return () => {
    reveals.delete(plot);
    shared?.unobserve(plot);
  };
}

/**
 * Run Root's entrance. Root's first commit decides it, before any mark places: with the entrance
 * on, the loop holds, Root writes `data-entrance="waiting"`, and the plot is watched until it
 * shows. The reveal waits for the next frame, which a hidden tab never paints, then writes
 * `"played"`, so the CSS wipe and the loop both start in a painted frame, and the plot is no
 * longer watched. With the entrance off, the marks draw at rest. A print draws every mark at rest,
 * which ends an entrance that waits or runs.
 *
 * @param store - The Root's store, whose phase marks read as they draw.
 * @param motion - The Root's loop.
 * @param root - Root's figure.
 * @param plot - Root's plot, which the observer watches.
 * @param entrance - Whether Root has an entrance: `data-intro` is not "none" and the reader allows
 *   motion. Turning it off while the entrance waits draws the marks at rest.
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
    if (store.get().phase === "waiting") {
      if (entrance) {
        motion.wait();
        writeAttribute(figure, "data-entrance", "waiting");
        stop = watch(box, () => {
          stop();
          requestAnimationFrame(() => {
            start("played");
          });
        });
      } else start(null);
    }
    return () => {
      stop();
      removeEventListener("beforeprint", print);
    };
  }, [store, motion, root, plot, entrance]);
}
