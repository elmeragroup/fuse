"use client";

/**
 * The state a Line and an Area keep for their series: the vertices over the measured plot, their
 * topology, the look the writer reads, the resting numbers and what the part placed last. Each part
 * then registers with Root's loop itself, so its writer stays bound in its own module.
 */
import { useId, useMemo, useRef, useState } from "react";

import type { ChartRootContextValue } from "./chart-context";
import type { ValueAxis } from "./chart-motion";
import { stepRole } from "./chart-paint";
import { centreAlong, pathAxes } from "./chart-path-draw";
import type { PathLook, PathMemory } from "./chart-path-draw";
import { useChartFrame } from "./chart-plot";
import type { ChartFrame } from "./chart-plot";
import { useFirstPhase } from "./chart-store";
import type { ChartColor, ChartCurve } from "./chart-types";
import type { SeriesModel } from "./layout/cartesian-model";
import { seriesPaint } from "./layout/color-key";
import { pathValues, topologyOf } from "./layout/line-path";
import type { PathTopology } from "./layout/line-path";
import { valueAt } from "./layout/plot-frame";
import { seriesPath } from "./layout/series-path";
import type { SeriesPath } from "./layout/series-path";

/** What a series path part draws from. */
export type SeriesPathState = {
  readonly series: SeriesModel | undefined;
  readonly seriesIndex: number;
  readonly color: ChartColor;
  /** The series paint as CSS, the consumer's override first. */
  readonly paint: string;
  readonly drawn: ChartFrame | null;
  /** The id prefix of the part's clip paths and paint servers. */
  readonly prefix: string;
  /** What the part writes on `data-intro`: nothing in Root's entrance, `fade` after a data update, else `none`. */
  readonly intro: "fade" | "none" | undefined;
  readonly path: SeriesPath | null;
  readonly topology: PathTopology;
  readonly look: PathLook | null;
  /** The resting numbers, which React's `d` and the loop's last frame both draw. */
  readonly rest: readonly number[];
  readonly axes: ValueAxis[];
  readonly memoryRef: { current: PathMemory | null };
  readonly lastLookRef: { current: PathLook | null };
  readonly outgoingRef: { current: SVGGElement | null };
  /** The width the part strokes its path in, which the look's placement reads. */
  readonly strokeRef: { current: number };
};

/**
 * Lay out one series path over Root's measured plot.
 *
 * @param part - The calling part's display name.
 * @param context - Root's context.
 * @param dataKey - The series key.
 * @param curve - The curve.
 * @param stride - The numbers per vertex, `LINE_STRIDE` or `AREA_STRIDE`.
 * @param stroke - The width the part strokes its path in before it reads its computed style, CSS
 *   pixels, 0 for a fill.
 * @returns The state the part draws from.
 */
export function useSeriesPath(
  part: string,
  context: ChartRootContextValue,
  dataKey: string,
  curve: ChartCurve,
  stride: number,
  stroke: number
): SeriesPathState {
  const { model, update, xScale } = context;
  const series = model.series.find(({ key }) => key === dataKey);
  const config = context.config[dataKey];
  const color = config?.color ?? "chart-1";
  const drawn = useChartFrame(part);
  const frame = drawn?.frame ?? null;
  const prefix = `${part === "Chart.Area" ? "chart-area" : "chart-line"}-${useId().replace(/[^\w-]/gu, "")}`;
  const phase = useFirstPhase(context.store);
  const [intro] = useState((): "fade" | "none" | undefined => {
    if (phase === "mounted") return update.kind === "data" ? "fade" : "none";
    return context.entrance ? undefined : "none";
  });
  // A decimated window keeps M4's vertices for each pixel column along the slot axis.
  const columns =
    frame === null ? undefined : frame.orientation === "vertical" ? frame.box.width : frame.box.height;
  const path = useMemo(
    () => (series === undefined ? null : seriesPath(model, series, update.keys, columns)),
    [model, series, update.keys, columns]
  );
  const missing = config?.missing ?? "gap";
  const topology = useMemo(() => topologyOf(path?.vertices ?? [], missing), [path, missing]);
  const moving = useRef<PathTopology | null>(null);
  const strokeRef = useRef(stroke);
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
            stroke: strokeRef,
          },
    [frame, xScale, curve, topology, prefix]
  );
  const rest = useMemo(
    () =>
      frame === null || path === null
        ? []
        : pathValues(path.vertices, stride, centreAlong(frame, xScale), (value) => valueAt(frame, value)),
    [frame, path, xScale, stride]
  );
  const axes = useMemo(() => pathAxes(context.orientation, stride), [context.orientation, stride]);
  const memoryRef = useRef<PathMemory | null>(null);
  const lastLookRef = useRef<PathLook | null>(null);
  const outgoingRef = useRef<SVGGElement | null>(null);
  return {
    series,
    seriesIndex: series?.seriesIndex ?? 0,
    color,
    paint: seriesPaint(dataKey, stepRole(color, undefined)),
    drawn,
    prefix,
    intro,
    path,
    topology,
    look,
    rest,
    axes,
    memoryRef,
    lastLookRef,
    outgoingRef,
    strokeRef,
  };
}
