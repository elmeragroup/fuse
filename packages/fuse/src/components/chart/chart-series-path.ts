"use client";

/**
 * The life of a series path, which a Line, an Area and a Bar's path form share. `usePathMark` owns
 * a path's registration with Root's loop, the commit classifier, the placement of every commit and
 * the route record's cleanup. `useSeriesPath` adds what a Line and an Area lay out for their series:
 * the curve rule, the vertices over the measured plot, their topology, the look and the resting
 * numbers. Each part keeps its writer at module scope in its own module and hands it in.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefCallback, RefObject } from "react";

import type { ChartLayoutContextValue, ChartRootContextValue } from "./chart-context";
import { useSvgIdPrefix } from "./chart-dom";
import type { MarkValues, ValueAxis } from "./chart-motion";
import { useCommitMotion, useMotionMark } from "./chart-motion-mark";
import type { MotionWriter, WriterLook } from "./chart-motion-mark";
import { seriesPaintOf, stackedScaleError } from "./chart-paint";
import type { SeriesPaint } from "./chart-paint";
import { centreAlong, pathAxes, placePath, seriesPathKind, slotStep } from "./chart-path-draw";
import type { Counted, DrawnPath, PathKind, PathLook, PathMemory } from "./chart-path-draw";
import type { PathKind as RouteKind } from "./chart-paths";
import { useChartFrame, usePlotRead } from "./chart-plot";
import type { ChartPlot } from "./chart-plot";
import { introFor, useFirstPhase } from "./chart-store";
import type { ChartCurve } from "./chart-types";
import type { SeriesModel } from "./layout/cartesian-model";
import { ChartCompositionError } from "./layout/errors";
import { pathValues, topologyOf } from "./layout/line-path";
import type { PathTopology } from "./layout/line-path";
import { valueAt } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";
import { seriesOf } from "./layout/series-of";
import { seriesPathOf } from "./layout/series-path";

/** What a path mark places in a commit, or null before the plot is measured. */
export type PathDraw<L, S extends Counted, T> = {
  readonly look: L;
  readonly kind: PathKind<S, T>;
  /** The new vertices' keys and places, and the new window's slots. */
  readonly path: DrawnPath;
  readonly topology: S;
  /** The resting numbers of the new vertices. */
  readonly rest: MarkValues;
};

/** A path mark's handles: its node's ref and the crossfade's group. */
export type PathMark = {
  readonly markRef: RefCallback<SVGGElement>;
  readonly outgoingRef: RefObject<SVGGElement | null>;
  readonly node: () => SVGGElement | null;
};

/**
 * Register a series path with Root's loop and place it on every commit: a data update tweens its
 * route or crossfades it, and every other commit places its rest as the commit classifier asks.
 * The path's route record leaves with the mark.
 *
 * @param draw - The part's writer, bound at module scope in the part's module.
 * @param input - Root's context, the plot the path draws in, the series and what draws it, the
 *   writer's look, and what the commit places, or null before the plot is measured.
 * @returns The path's handles.
 */
export function usePathMark<
  L extends WriterLook<L> & { readonly moving: { current: S | null } },
  S extends Counted,
  T,
>(
  draw: MotionWriter<SVGGElement, L | null>,
  input: {
    readonly context: ChartRootContextValue;
    readonly plot: ChartPlot | null;
    readonly axes: ValueAxis[];
    readonly seriesIndex: number;
    readonly route: RouteKind;
    readonly placed: PathDraw<L, S, T> | null;
  }
): PathMark {
  const { context, plot, axes, seriesIndex, route, placed } = input;
  const { motion, update, paths, followers } = context;
  const mark = useMotionMark(motion, draw, placed?.look ?? null, axes);
  const commit = useCommitMotion(update, plot, context.orientation);
  const memoryRef = useRef<PathMemory<S> | null>(null);
  const lastLookRef = useRef<L | null>(null);
  const outgoingRef = useRef<SVGGElement | null>(null);
  useLayoutEffect(() => {
    const asked = commit();
    if (placed === null) return;
    placePath(asked, {
      mark,
      motion,
      paths,
      seriesIndex,
      drawn: route,
      kind: placed.kind,
      look: placed.look,
      path: placed.path,
      topology: placed.topology,
      rest: placed.rest,
      memory: memoryRef,
      lastLook: lastLookRef,
      outgoing: outgoingRef.current,
      draw,
    });
  });
  // A follower joined to this path's route rebuilds its join against what still draws the series.
  useLayoutEffect(
    () => () => {
      paths.delete(seriesIndex, route, memoryRef);
      followers.refresh();
    },
    [paths, followers, seriesIndex, route]
  );
  return { markRef: mark.ref, outgoingRef, node: mark.node };
}

/**
 * How a Line reads the width it strokes its path in: a guess for its first draw, its own props that
 * can change it, and the reader of its node's computed style.
 */
export type PathStroke = {
  /** The width before the first read, CSS pixels. */
  readonly guess: number;
  /** The Line's own props that set the width, such as the variant, the class and the style, compared by identity. */
  readonly inputs: readonly unknown[];
  /** Reads the width off the mark's node. */
  readonly read: (node: SVGGElement) => number;
};

/** A part with no props of its own that set its stroke. */
const NO_INPUTS: readonly unknown[] = [];

/** What a series path part draws from. */
export type SeriesPathState = PathMark & {
  readonly series: SeriesModel | undefined;
  readonly seriesIndex: number;
  /** The series paint, every stop with the consumer's override first. */
  readonly paint: SeriesPaint;
  readonly frame: PlotFrame | null;
  /** The id prefix of the part's clip paths and paint servers. */
  readonly prefix: string;
  /** What the part writes on `data-intro`: nothing in Root's entrance, `fade` after a data update, else `none`. */
  readonly intro: "fade" | "none" | undefined;
  /** What the part's first draw renders from: the look, the resting numbers and their topology. */
  readonly resting: {
    readonly look: PathLook;
    readonly rest: readonly number[];
    readonly topology: PathTopology;
  } | null;
};

/**
 * Lay out one series path over the measured plot, and place it on Root's loop through
 * `usePathMark`.
 *
 * @param part - The calling part's display name.
 * @param draw - The part's writer, bound at module scope in the part's module.
 * @param options - Root's context and the part's layout, the series key, the curve, the route kind,
 *   the numbers per vertex, `LINE_STRIDE` or `AREA_STRIDE`, and how a stroked path reads its width.
 * @returns The state the part draws from.
 * @throws {ChartCompositionError} `step-curve-needs-cells` for a step curve under a point scale, and
 *   `scale-colour-on-stack` for a scale colour on a stacked series.
 */
export function useSeriesPath(
  part: string,
  draw: MotionWriter<SVGGElement, PathLook | null>,
  options: {
    readonly context: ChartRootContextValue;
    readonly layout: ChartLayoutContextValue;
    readonly dataKey: string;
    readonly curve: ChartCurve;
    /** What draws the path, which names its anchor and its route record. */
    readonly route: "line" | "area";
    readonly stride: number;
    readonly stroke?: PathStroke;
  }
): SeriesPathState {
  const { context, layout, dataKey, curve, route, stride, stroke } = options;
  const { model, update, xScale } = context;
  if ((curve === "step-after" || curve === "step-before") && xScale === "point") {
    throw new ChartCompositionError(
      part,
      "step-curve-needs-cells",
      `draws curve="${curve}" under xScale="point", where slots have no cells to run across. Use xScale="band", or curve="step".`
    );
  }
  const series = seriesOf(model, dataKey);
  const config = context.config[dataKey];
  const color = config?.color ?? "chart-1";
  const stacked = model.stacks.some(({ keys }) => keys.includes(dataKey));
  const scaleRule = stackedScaleError(part, color, stacked, context.stackOffset);
  if (scaleRule !== null) throw scaleRule;
  const drawn = useChartFrame(part, layout);
  const frame = drawn?.frame ?? null;
  const prefix = useSvgIdPrefix(`chart-${route}`);
  const phase = useFirstPhase(context.store);
  const [intro] = useState(() => introFor(phase, update.kind, context.entrance));
  // A decimated window keeps M4's vertices for each pixel column along the slot axis.
  const columns =
    frame === null ? undefined : frame.orientation === "vertical" ? frame.box.width : frame.box.height;
  const path = useMemo(
    () => (series === undefined ? null : seriesPathOf(model, series, update.keys, columns)),
    [model, series, update.keys, columns]
  );
  const paint = useMemo(() => seriesPaintOf(dataKey, color, series), [dataKey, color, series]);
  const missing = config?.missing ?? "gap";
  const topology = useMemo(() => topologyOf(path?.vertices ?? [], missing), [path, missing]);
  const moving = useRef<PathTopology | null>(null);
  // The width the part strokes its path in, which the placement reads, so a straight stroke covers
  // whole device pixels at any width. A consumer's --chart-stroke on Root or the Line, or the look,
  // sets it, so the part reads the computed style in the plot's probe phase, before any mark of the
  // commit writes, and again when its own props change.
  const [width, setWidth] = useState(stroke?.guess ?? 0);
  // The width last read, so an unchanged width schedules no render at all.
  const readWidth = useRef(width);
  const look = useMemo(
    (): PathLook | null =>
      frame === null
        ? null
        : {
            frame,
            xScale,
            curve,
            topology,
            moving,
            clips: { solid: `${prefix}-solid`, marked: `${prefix}-marked` },
            stroke: { width },
          },
    [frame, xScale, curve, topology, prefix, width]
  );
  const rest = useMemo(
    () =>
      frame === null || path === null
        ? []
        : pathValues(path.vertices, stride, centreAlong(frame, xScale), (value) => valueAt(frame, value)),
    [frame, path, xScale, stride]
  );
  const axes = useMemo(() => pathAxes(context.orientation, stride), [context.orientation, stride]);
  const kind = useMemo(
    () => (frame === null ? null : seriesPathKind(stride, slotStep(frame, xScale))),
    [frame, stride, xScale]
  );
  const placed = useMemo(
    () => (look === null || path === null || kind === null ? null : { look, kind, path, topology, rest }),
    [look, path, kind, topology, rest]
  );
  const mark = usePathMark(draw, {
    context,
    plot: drawn?.plot ?? null,
    axes,
    seriesIndex: series?.seriesIndex ?? 0,
    route,
    placed,
  });
  usePlotRead(() => {
    const group = mark.node();
    if (stroke === undefined || group === null) return false;
    const next = stroke.read(group);
    if (next !== readWidth.current) {
      readWidth.current = next;
      setWidth(next);
    }
    return true;
  }, stroke?.inputs ?? NO_INPUTS);
  return {
    ...mark,
    series,
    seriesIndex: series?.seriesIndex ?? 0,
    paint,
    frame,
    prefix,
    intro,
    resting: look === null || series === undefined ? null : { look, rest, topology },
  };
}
