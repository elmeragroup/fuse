"use client";

/**
 * The paint of a Line or an Area, after CONTRACT section 8.9. A role paints the series' own colour.
 * A role list is decorative and runs along the slot axis. A scale follows the value: one
 * `userSpaceOnUse` gradient along the value axis with hard stops at the bin edges, so the stroke and
 * the fill take the step of the value they pass, and a riser crosses the steps between its ends.
 */
import type { ReactElement } from "react";

import { isRoleList, stepRole } from "./chart-paint";
import type { ChartColor } from "./chart-types";
import type { SeriesModel } from "./layout/cartesian-model";
import { binEdges } from "./layout/color-bins";
import { seriesPaint } from "./layout/color-key";
import { valueAt } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";

/** One gradient stop: its offset, 0 to 1, and its paint. */
type Stop = { readonly offset: number; readonly paint: string };

/** The stops of a scale along the value axis, from the gradient's start at the plot's top or left. */
function scaleStops(
  key: string,
  color: "chart-seq" | "chart-diverging",
  series: SeriesModel,
  frame: PlotFrame
): Stop[] {
  const values = series.readings.flatMap((reading) => (reading.kind === "reading" ? [reading.value] : []));
  const edges = binEdges(color, values);
  if (edges.length === 0) return [{ offset: 0, paint: seriesPaint(key, stepRole(color, 4)) }];
  const length = frame.orientation === "vertical" ? frame.box.height : frame.box.width;
  const share = (value: number) =>
    length === 0 ? 0 : Math.min(1, Math.max(0, valueAt(frame, value) / length));
  // Step k lies between edge k − 1 and edge k, which a vertical frame draws from the bottom up.
  const regions = Array.from({ length: 7 }, (_, index) => ({
    step: index + 1,
    low: index === 0 ? Number.NEGATIVE_INFINITY : (edges[index - 1] ?? 0),
    high: index === 6 ? Number.POSITIVE_INFINITY : (edges[index] ?? 0),
  }));
  const ordered = frame.orientation === "vertical" ? regions.toReversed() : regions;
  return ordered.flatMap(({ step, low, high }) => {
    const paint = seriesPaint(key, stepRole(color, step));
    const ends = [
      share(Number.isFinite(low) ? low : -Number.MAX_VALUE),
      share(Number.isFinite(high) ? high : Number.MAX_VALUE),
    ];
    const [start = 0, end = 0] = ends.toSorted((a, b) => a - b);
    return [
      { offset: start, paint },
      { offset: end, paint },
    ];
  });
}

/**
 * The gradient a series path paints from, or nothing for a single role, which paints through the
 * series' own colour.
 *
 * @param props - The gradient's id, the series, its colour and the frame it draws in.
 * @returns The gradient, or null.
 */
export function PathPaint({
  id,
  series,
  color,
  frame,
}: {
  readonly id: string;
  readonly series: SeriesModel;
  readonly color: ChartColor;
  readonly frame: PlotFrame;
}): ReactElement | null {
  const vertical = frame.orientation === "vertical";
  const { width, height } = frame.box;
  let stops: Stop[];
  let ends: { readonly x2: number; readonly y2: number };
  if (isRoleList(color)) {
    // A role list runs along the slot axis, decoration that follows no value.
    stops = color.map((role, index) => ({
      offset: index / Math.max(1, color.length - 1),
      paint: seriesPaint(series.key, role),
    }));
    ends = vertical ? { x2: width, y2: 0 } : { x2: 0, y2: height };
  } else if (color === "chart-seq" || color === "chart-diverging") {
    stops = scaleStops(series.key, color, series, frame);
    ends = vertical ? { x2: 0, y2: height } : { x2: width, y2: 0 };
  } else {
    return null;
  }
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={ends.x2} y2={ends.y2}>
      {stops.map((stop, index) => (
        // The stops never reorder within one gradient, so the position is their identity.
        <stop key={index} offset={stop.offset} style={{ "--chart-stop": stop.paint }} />
      ))}
    </linearGradient>
  );
}

/**
 * Whether a series colour paints through a gradient.
 *
 * @param color - The series colour.
 * @returns Whether `PathPaint` draws one.
 */
export function hasPathPaint(color: ChartColor): boolean {
  return isRoleList(color) || color === "chart-seq" || color === "chart-diverging";
}

Object.assign(PathPaint, { displayName: "Chart.PathPaint" });
