"use client";

/**
 * How one mark binds to Root's animation loop. `useMotionMark` owns a mark's registration for the
 * mark's whole life: it draws into whichever node the mark renders now, so a node that React
 * replaces keeps its motion, and it forgets the mark when the mark unmounts. `useCommitMotion`
 * tells a mark how to reach the geometry of each commit it draws.
 */
import { useCallback, useId, useLayoutEffect, useMemo, useRef } from "react";
import type { RefCallback } from "react";

import type { ChartUpdate } from "./chart-context";
import type { FollowerCause } from "./chart-followers";
import { SAME_PLOT } from "./chart-motion";
import type { ChartMotion, MarkValues, Placement, PlotScale, ValueAxis } from "./chart-motion";
import type { ChartPlot } from "./chart-plot";

/** A mark's numbers, one per declared axis, so the values a mark places match what it declares. */
export type MarkTuple<A extends readonly ValueAxis[]> = { readonly [K in keyof A]: number };

/**
 * What a writer reads besides its node and the numbers the loop draws: the measured frame, the look,
 * its paint and its wiring. A target coordinate is a number, or a list of them, which this type
 * refuses at the look's top level, so a writer draws its geometry from the loop's numbers alone. A
 * number nested in an object passes, as the measured frame's box must; the module-scope writer the
 * central suite requires keeps every other input of the writer in its signature, where a reviewer
 * reads it.
 */
export type WriterLook<L> = {
  readonly [K in keyof L]: L[K] extends number | readonly unknown[] ? never : L[K];
};

/** A mark's writer: a module-scope function of its node, its look and the numbers the loop draws. */
export type MotionWriter<T extends Element, L> = (node: T, look: L, values: MarkValues) => void;

/** One mark's registration with Root's loop. */
export type MotionMark<T extends Element, A extends readonly ValueAxis[]> = {
  /** Pass it as the drawn element's `ref`. One mark may render one element type or another. */
  readonly ref: RefCallback<T>;
  /** The element on screen, for writes beyond the loop's geometry. */
  readonly node: () => T | null;
  /** Draw the mark at a target through the loop, one number per declared axis. */
  readonly place: (target: MarkTuple<A>, placement: Placement, anchor?: string) => void;
};

/**
 * Register a mark with Root's loop for as long as it is mounted.
 *
 * @param motion - Root's loop.
 * @param write - Writes the loop's numbers onto the mark's node: a function bound at module scope,
 *   which the central suite checks, so it reads only its node, its look and the numbers.
 * @param look - The writer's look, the latest one drawing, with no target coordinate in it.
 * @param axes - What each of the mark's numbers measures, in order, so a resize maps them into the
 *   new box: a pixel along x or y from the plot's edge, or a size the box leaves alone. The latest
 *   declaration counts, as a reference that changes axis changes it, and its length types the
 *   numbers the mark places.
 * @returns The ref to pass to the mark's node and the placement function.
 */
export function useMotionMark<
  T extends Element,
  L extends WriterLook<L>,
  const A extends readonly ValueAxis[],
>(motion: ChartMotion, write: MotionWriter<T, L>, look: L, axes: A): MotionMark<T, A> {
  const id = useId();
  const node = useRef<T | null>(null);
  const latest = useRef({ write, look });
  const declared = useRef<readonly ValueAxis[]>(axes);
  useLayoutEffect(() => {
    latest.current = { write, look };
    declared.current = axes;
  });
  useLayoutEffect(
    () => () => {
      motion.forget(id);
    },
    [motion, id]
  );
  // React hands the ref every element that replaces the last, so the loop always draws the one on
  // screen.
  const ref = useCallback((element: T | null) => {
    node.current = element;
  }, []);
  const current = useCallback(() => node.current, []);
  const place = useCallback(
    (target: MarkTuple<A>, placement: Placement, anchor?: string) => {
      motion.place(
        id,
        target,
        (values) => {
          if (node.current !== null) latest.current.write(node.current, latest.current.look, values);
        },
        placement,
        declared.current,
        anchor
      );
    },
    [motion, id]
  );
  return useMemo(() => ({ ref, node: current, place }), [ref, current, place]);
}

/**
 * How a mark reaches the geometry of a commit: "first" for its first draw, which runs the entrance
 * or snaps, "move" for a data update, "snap" for a range step or a change of the mark's coordinate
 * space, either of which lays the mark out anew, and "settle" for a resize or any other commit,
 * which lets a running update finish.
 */
export type CommitMotion = "first" | "move" | "snap" | "settle";

/** What a commit asks of a mark, and how it scaled the plot's box since the mark last drew. */
export type Commit = { readonly kind: CommitMotion; readonly scale: PlotScale };

/** How the plot's box scaled from one measurement to the next, 1 where either has no size. */
function scaleOf(previous: ChartPlot | null, plot: ChartPlot | null): PlotScale {
  if (previous === null || plot === null || previous === plot) return SAME_PLOT;
  const ratio = (now: number, before: number) => (before > 0 && now > 0 ? now / before : 1);
  return {
    x: ratio(plot.box.width, previous.box.width),
    y: ratio(plot.box.height, previous.box.height),
    to: plot,
  };
}

/**
 * Track the commits a mark has drawn, so its layout effect can tell a data update from a resize.
 *
 * @param update - Root's current update.
 * @param plot - Root's current measurement.
 * @param space - The coordinate space the mark's numbers live in: Root's orientation, and for a
 *   reference its axis too. A change of space reinterprets every number the mark drew, so it snaps.
 * @returns A function the mark's layout effect calls once per draw.
 */
export function useCommitMotion(update: ChartUpdate, plot: ChartPlot | null, space: string): () => Commit {
  const last = useRef<{
    readonly update: ChartUpdate;
    readonly plot: ChartPlot | null;
    readonly space: string;
  } | null>(null);
  // A mark that unmounts forgets what it drew, so a remount, as Strict Mode rehearses one, draws
  // its first commit again.
  useLayoutEffect(
    () => () => {
      last.current = null;
    },
    []
  );
  return () => {
    const previous = last.current;
    last.current = { update, plot, space };
    const commit = (kind: CommitMotion): Commit => ({ kind, scale: scaleOf(previous?.plot ?? null, plot) });
    if (previous === null) return commit("first");
    if (previous.space !== space) return commit("snap");
    if (previous.update === update || previous.plot !== plot) return commit("settle");
    // A data update moves the marks that stay, unless it relays the plot, which snaps them all.
    return commit(update.kind === "data" && !update.relays ? "move" : "snap");
  };
}

/** How a Bar draws its series: one element per bar, or one path per series, which snaps to new data. */
export type SeriesForm = "bars" | "path";

/**
 * The loop's placement for a commit, the one owner every mark asks. A first draw snaps unless the
 * mark brings an entrance of its own. A data update moves, except for a mark of, or attached to, a
 * series in the path form, whose paths draw new data at once, so its overlay and followers snap with
 * it. A settle carries the commit's scale, and a snap snaps.
 *
 * @param commit - What the commit asks of the mark, from `useCommitMotion`.
 * @param options - The entrance a mark's first draw runs instead of snapping, if any, and the form
 *   of the series the mark draws or follows, "bars" by default.
 * @returns The placement.
 */
export function placementOf(
  commit: Commit,
  options: { readonly entrance?: Placement; readonly form?: SeriesForm } = {}
): Placement {
  const { kind, scale } = commit;
  if (kind === "first") return options.entrance ?? { kind: "snap" };
  if (kind === "move") return options.form === "path" ? { kind: "snap" } : { kind: "move" };
  if (kind === "settle") return { kind: "settle", scale };
  return { kind: "snap" };
}

/**
 * How a follower reaches its geometry each time Root paints it: a pointer or key step snaps, and a
 * commit asks the follower's commit classifier. A follower calls the result first in every paint,
 * before it decides whether it shows, so the classifier sees every commit.
 *
 * @param update - Root's current update.
 * @param plot - Root's current measurement.
 * @param space - The coordinate space the follower's numbers live in, as `useCommitMotion` reads it.
 * @returns The placement for a paint's cause and the form of the series the follower attaches to.
 *   A follower with a bar to join, its anchor and the follower's numbers from the bar's, joins that
 *   bar's tween in every paint, a step's or a commit's, or snaps where the bar rests, so it draws on
 *   its bar whatever it drew before, as when it steps onto a bar mid-update or shows again. The
 *   path form draws no bar to join, and its followers take the series' placement.
 */
export function useFollowerPlacement(
  update: ChartUpdate,
  plot: ChartPlot | null,
  space: string
): (
  cause: FollowerCause,
  form: SeriesForm,
  join?: { readonly anchor: string; readonly pick: (values: MarkValues) => MarkValues }
) => Placement {
  const commit = useCommitMotion(update, plot, space);
  return (cause, form, join) => {
    // The classifier sees every commit, whichever placement the follower takes.
    const placement: Placement = cause === "step" ? { kind: "snap" } : placementOf(commit(), { form });
    return join === undefined || form === "path" ? placement : { kind: "join", ...join };
  };
}
