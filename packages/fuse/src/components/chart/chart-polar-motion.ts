"use client";

/**
 * How a polar mark moves on its Root's loop (D5, D17, Q7), the one module that places polar marks.
 * The first draw plays the entrance: each item sweeps or grows from its start over `--chart-intro`,
 * 1 s, after its family's stagger, and waits at that start until the chart comes into view. A data
 * update moves every item that stays over `--chart-update`, 480 ms, grows an item that enters from
 * its start, and collapses an item that leaves into a ghost: a path the writer draws in an empty
 * `<g>` React never renders into, removed on its last frame. Reduced motion and print draw every
 * mark at rest at once, through the loop's snap. The cartesian binder, `useMotionMark`, reads the
 * cartesian layout, so a polar mark binds through `usePolarMark` and asks `usePolarCommit`.
 */
import { useCallback, useId, useLayoutEffect, useMemo, useRef } from "react";
import type { RefCallback } from "react";

import { SAME_PLOT } from "./chart-motion";
import type { ChartMotion, MarkValues, Placement } from "./chart-motion";
import type { PolarContextValue, PolarUpdate } from "./chart-polar-context";
import { CHART_INTRO_MS, introDelay } from "./layout/polar-motion";
import { sameItems } from "./layout/same-items";

/** Writes the loop's numbers onto a polar mark's node, in the look it draws. */
export type PolarWriter<T extends Element, L> = (node: T, look: L, values: MarkValues) => void;

/** A polar mark's binding to its Root's loop. */
export type PolarMark<T extends Element> = {
  /** The ref to pass to the mark's node. */
  readonly ref: RefCallback<T>;
  /** Place the mark's numbers for this commit. */
  readonly place: (target: MarkValues, placement: Placement) => void;
};

/**
 * Register a polar mark with its Root's loop for as long as it is mounted. The loop draws into
 * whichever node the mark renders now, in the latest look.
 *
 * @param motion - The Root's loop.
 * @param write - Writes the loop's numbers onto the mark's node.
 * @param look - What the writer reads beside the numbers, such as the dial's radii.
 * @returns The ref and the placement function.
 */
export function usePolarMark<T extends Element, L>(
  motion: ChartMotion,
  write: PolarWriter<T, L>,
  look: L
): PolarMark<T> {
  const id = useId();
  const node = useRef<T | null>(null);
  const latest = useRef({ write, look });
  useLayoutEffect(() => {
    latest.current = { write, look };
  });
  useLayoutEffect(
    () => () => {
      motion.forget(id);
    },
    [motion, id]
  );
  const ref = useCallback((element: T | null) => {
    node.current = element;
  }, []);
  const place = useCallback(
    (target: MarkValues, placement: Placement) => {
      motion.place(
        id,
        target,
        (values) => {
          const shown = node.current;
          if (shown === null) return;
          latest.current.write(shown, latest.current.look, values);
        },
        placement
      );
    },
    [motion, id]
  );
  return useMemo(() => ({ ref, place }), [ref, place]);
}

/**
 * Track the commits a polar mark draws, so its layout effect knows how to reach each one. The
 * mark's first draw in the Root's first commit plays the entrance, or snaps without one. A mark
 * that first draws in a data update enters: it grows from its start on the update's clock, as its
 * key is new. A later data update moves it from what it drew, and any other commit lets a running
 * tween finish. An update never replays the entrance.
 *
 * @param polar - The mark's Root.
 * @returns A function the mark's layout effect calls once per draw, with the mark's place in its
 *   family's stagger, a slice, a ring or a series, and where it starts when it enters: zero width
 *   at its start angle, or radius 0.
 */
export function usePolarCommit(
  polar: Pick<PolarContextValue, "update" | "entrance" | "model">
): (index: number, from: MarkValues) => Placement {
  const last = useRef<PolarUpdate | null>(null);
  // A mark that unmounts forgets what it drew, so a remount, as Strict Mode rehearses one, draws
  // its first commit again.
  useLayoutEffect(
    () => () => {
      last.current = null;
    },
    []
  );
  return (index, from) => {
    const previous = last.current;
    last.current = polar.update;
    if (previous === null) {
      if (polar.update.kind === "data") return { kind: "enter", from, delay: 0 };
      if (!polar.entrance) return { kind: "snap" };
      return { kind: "enter", from, delay: introDelay(polar.model.family, index), duration: CHART_INTRO_MS };
    }
    // The dial scales with its cell, so a commit with no new data leaves the numbers in place.
    if (previous === polar.update) return { kind: "settle", scale: SAME_PLOT };
    return { kind: "move" };
  };
}

/** Draws a ghost's numbers onto its path. */
export type GhostWriter = (path: SVGPathElement, values: MarkValues) => void;

/**
 * Collapse a leaving item into a ghost (D5): a path in `layer` that tweens from what the item drew
 * to its collapsed numbers on the update's clock, then leaves the DOM. A second update while it
 * collapses starts from where it shows, as every tween does.
 *
 * @param motion - The Root's loop.
 * @param layer - An empty `<g>` the mark renders, which React never renders children into.
 * @param id - The ghost's loop id, unique for the leaving key.
 * @param from - What the item drew last.
 * @param to - Its collapsed numbers, such as zero width at its end angle.
 * @param write - Draws the numbers onto the ghost's path.
 * @param attributes - The ghost path's own attributes, such as its slot and fill.
 */
export function placeExit(
  motion: ChartMotion,
  layer: SVGGElement,
  id: string,
  from: MarkValues,
  to: MarkValues,
  write: GhostWriter,
  attributes: Readonly<Record<string, string>> = {}
): void {
  const path = layer.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
  for (const [name, value] of Object.entries(attributes)) path.setAttribute(name, value);
  path.setAttribute("data-ghost", "");
  layer.append(path);
  const draw = (values: MarkValues): void => {
    write(path, values);
    // The last frame writes the target itself, so the ghost leaves once it reaches its collapse.
    if (sameItems(values, to)) {
      path.remove();
      // The loop may be walking its marks while it writes this frame, so it forgets the ghost after.
      queueMicrotask(() => {
        motion.forget(id);
      });
    }
  };
  motion.place(id, from, draw, { kind: "snap" });
  motion.place(id, to, draw, { kind: "move" });
}
