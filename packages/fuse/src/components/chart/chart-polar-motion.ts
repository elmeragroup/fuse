"use client";

/**
 * How a polar mark moves on its Root's loop, the one module that places polar marks.
 * The first draw plays the entrance: each item sweeps or grows from its start over `--chart-intro`,
 * 1 s, after its family's stagger, and waits at that start until the chart comes into view. A data
 * update moves every item that stays over `--chart-update`, 480 ms, grows an item that enters from
 * its start, and collapses an item that leaves into a ghost: a path the writer draws in an empty
 * `<g>` React never renders into, removed on its last frame. Reduced motion and print draw every
 * mark at rest at once, through the loop's snap. The cartesian binder, `useMotionMark`, reads the
 * cartesian layout, so a polar mark binds through `usePolarMark` and asks `usePolarCommit`.
 */
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefCallback } from "react";

import { SAME_PLOT } from "./chart-motion";
import type { ChartMotion, MarkValues, Placement } from "./chart-motion";
import type { PolarContextValue, PolarUpdate } from "./chart-polar-context";
import { cssTime, DEFAULT_PACE, introDelay, introTiming } from "./layout/polar-motion";
import type { IntroPace } from "./layout/polar-motion";
import { sameItems } from "./layout/same-items";

/** Writes the loop's numbers onto a polar mark's node, in the look it draws. */
export type PolarWriter<T extends Element, L> = (node: T, look: L, values: MarkValues) => void;

/** A polar mark's binding to its Root's loop. */
export type PolarMark<T extends Element> = {
  /** The ref to pass to the mark's node. */
  readonly ref: RefCallback<T>;
  /** Place the mark's numbers for this commit. */
  readonly place: (target: MarkValues, placement: Placement) => void;
  /** The node the mark renders now, or null before it mounts. */
  readonly node: () => T | null;
  /** The numbers the loop drew the mark at last, mid-tween too, or null before it places one. */
  readonly drawn: () => MarkValues | null;
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
  const shown = useCallback(() => node.current, []);
  const drawn = useCallback(() => motion.drawn(id), [motion, id]);
  return useMemo(() => ({ ref, place, node: shown, drawn }), [ref, place, shown, drawn]);
}

/**
 * Track the commits a polar mark draws, so its layout effect knows how to reach each one. The
 * mark's first draw in the Root's first commit plays the entrance, or snaps without one. A mark
 * that first draws in a data update enters: it grows from its start on the update's clock, as its
 * key is new. A later data update moves it from what it drew, and any other commit lets a running
 * tween finish. An update never replays the entrance. While the entrance still waits for the chart
 * to come into view, every commit places the entrance again under its numbers, so the chart plays
 * it with the latest data. Once the entrance has started it is spent: a mark that draws again from
 * nothing, as every mark does when React Activity shows the chart again, or that mounts later with
 * no new data, snaps to rest, as the cartesian marks do, so nothing grows a second time.
 *
 * @param polar - The mark's Root.
 * @param anchor - The mark's node, which inherits the figure's pace. The marks place their entrance
 *   before the Root's figure ref attaches, so the entrance reads its pace through the mark.
 * @returns A function the mark's layout effect calls once per draw, with the mark's place in its
 *   family's stagger, a slice, a ring or a series, where it starts when it enters: zero width at its
 *   start angle, or radius 0, and for an update whose numbers change in length the route between
 *   them, as a clock's slots pair across a change of slot count.
 */
export function usePolarCommit(
  polar: Pick<PolarContextValue, "update" | "entrance" | "model" | "kernel">,
  anchor: () => Element | null
): (
  index: number,
  from: MarkValues,
  via?: { readonly from: MarkValues; readonly to: MarkValues }
) => Placement {
  const last = useRef<PolarUpdate | null>(null);
  const { update, entrance, kernel, model } = polar;
  // The commit the mark first mounted in, and whether its Root was hidden then. A mark is new only
  // in the data update it was born in, born while its Root showed, and drawn while it shows. React
  // Activity runs the Root's cleanup when it hides the chart and the marks' layout effects before
  // the Root's when it shows it again, so every mark draws a show while the Root still reads
  // hidden. A Strict Mode rehearsal of a mark runs no Root effect, so it reads shown.
  const [born] = useState(() => ({ update, hidden: kernel.hidden() }));
  // A mark that unmounts forgets what it drew, so a remount, as Strict Mode rehearses one, draws
  // its first commit again.
  useLayoutEffect(
    () => () => {
      last.current = null;
    },
    []
  );
  // It changes with the commit's inputs alone, so a part that places only when they change may key
  // its effect on it.
  return useCallback(
    (index, from, via) => {
      const previous = last.current;
      last.current = update;
      const phase = kernel.store.get().phase;
      // While Root's entrance waits, every commit places the entrance again under its numbers, as a
      // bar does, since the held loop would snap a move or a settle to rest.
      const waiting = entrance && phase === "waiting";
      if (previous === null && phase === "started") {
        const fresh = update.kind === "data" && born.update === update && !born.hidden && !kernel.hidden();
        return fresh ? { kind: "enter", from, delay: 0 } : { kind: "snap" };
      }
      if (previous === null || waiting) {
        if (!entrance) return { kind: "snap" };
        const pace = introPace(kernel.root() ?? anchor(), update);
        return {
          kind: "enter",
          from,
          delay: introDelay(model.family, index, pace),
          ...introTiming(model.family, pace),
        };
      }
      // The dial scales with its cell, so a commit with no new data leaves the numbers in place.
      if (previous === update) return { kind: "settle", scale: SAME_PLOT };
      // A clock that changes its slot count moves along the route that pairs its old slots with its new.
      return via === undefined ? { kind: "move" } : { kind: "move", via };
    },
    [update, entrance, kernel, model, anchor, born]
  );
}

/** Each commit's pace, read once from the figure for every mark the commit places. */
const paces = new WeakMap<PolarUpdate, IntroPace>();

/**
 * The entrance's pace as the figure's style sets it: `--chart-intro` and `--chart-stagger`, so a
 * consumer's override changes the entrance. A commit reads it once, from the first element that
 * reaches it, and an entrance placed with no element yet takes the stylesheet's pace unread.
 *
 * @param figure - The Root's figure, or any element inside it, whose custom properties it inherits.
 * @param update - The commit, which keys the reading.
 * @returns The pace.
 */
export function introPace(figure: Element | null, update: PolarUpdate): IntroPace {
  const known = paces.get(update);
  if (known !== undefined) return known;
  if (figure === null) return DEFAULT_PACE;
  const style = getComputedStyle(figure);
  const pace = {
    intro: cssTime(style.getPropertyValue("--chart-intro")) ?? DEFAULT_PACE.intro,
    stagger: cssTime(style.getPropertyValue("--chart-stagger")) ?? DEFAULT_PACE.stagger,
  };
  paces.set(update, pace);
  return pace;
}

/** Draws a ghost's numbers onto its path. */
export type GhostWriter = (path: SVGPathElement, values: MarkValues) => void;

/**
 * Collapse a leaving item into a ghost: a path in `layer` that tweens from what the item drew
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
