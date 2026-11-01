"use client";

/**
 * The paint of a Line or an Area, after CONTRACT section 8.9. A role paints the series' own colour.
 * A role list is decorative and runs along the slot axis. A scale follows the value: one
 * `userSpaceOnUse` gradient along the value axis with hard stops at the bin edges, so the stroke and
 * the fill take the step of the value they pass, and a riser crosses the steps between its ends.
 */
import type { ReactElement } from "react";

import type { SeriesPaint } from "./chart-paint";
import { valueAt } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";

/** One gradient stop: its offset, 0 to 1, and its paint. */
type Stop = { readonly offset: number; readonly paint: string };

/** The stops of a scale along the value axis, from the gradient's start at the plot's top or left. */
function scaleStops(paint: SeriesPaint, ramp: readonly string[], frame: PlotFrame): Stop[] {
  const { edges } = paint;
  if (edges.length === 0) return [{ offset: 0, paint: paint.base }];
  const length = frame.orientation === "vertical" ? frame.box.height : frame.box.width;
  const share = (value: number) =>
    length === 0 ? 0 : Math.min(1, Math.max(0, valueAt(frame, value) / length));
  // Step k lies between edge k − 1 and edge k, which a vertical frame draws from the bottom up.
  const regions = ramp.map((step, index) => ({
    step,
    low: index === 0 ? Number.NEGATIVE_INFINITY : (edges[index - 1] ?? 0),
    high: index === ramp.length - 1 ? Number.POSITIVE_INFINITY : (edges[index] ?? 0),
  }));
  const ordered = frame.orientation === "vertical" ? regions.toReversed() : regions;
  return ordered.flatMap(({ step, low, high }) => {
    const ends = [
      share(Number.isFinite(low) ? low : -Number.MAX_VALUE),
      share(Number.isFinite(high) ? high : Number.MAX_VALUE),
    ];
    const [start = 0, end = 0] = ends.toSorted((a, b) => a - b);
    return [
      { offset: start, paint: step },
      { offset: end, paint: step },
    ];
  });
}

/**
 * The gradient a series path paints from, or nothing for a single role, which paints through the
 * series' own colour.
 *
 * @param props - The gradient's id, the series paint and the frame it draws in.
 * @returns The gradient, or null.
 */
export function PathPaint({
  id,
  paint,
  frame,
}: {
  readonly id: string;
  readonly paint: SeriesPaint;
  readonly frame: PlotFrame;
}): ReactElement | null {
  const vertical = frame.orientation === "vertical";
  const { width, height } = frame.box;
  let stops: Stop[];
  let ends: { readonly x2: number; readonly y2: number };
  if (paint.stops !== undefined) {
    // A role list runs along the slot axis, decoration that follows no value.
    const list = paint.stops;
    stops = list.map((stop, index) => ({ offset: index / Math.max(1, list.length - 1), paint: stop }));
    ends = vertical ? { x2: width, y2: 0 } : { x2: 0, y2: height };
  } else if (paint.ramp !== undefined) {
    stops = scaleStops(paint, paint.ramp, frame);
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
 * Whether a series paints through a gradient.
 *
 * @param paint - The series paint.
 * @returns Whether `PathPaint` draws one.
 */
export function hasPathPaint(paint: SeriesPaint): boolean {
  return paint.stops !== undefined || paint.ramp !== undefined;
}

Object.assign(PathPaint, { displayName: "Chart.PathPaint" });
