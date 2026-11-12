/**
 * The measured plot of a scatter chart under its two value domains, and the paths its marks draw.
 * x runs left to right and y bottom to top, both linear. Every point lands on whole device pixels
 * from the layer's origin, as `plot-frame.ts` snaps a cartesian mark: a dot of an even device-pixel
 * diameter centres on a pixel edge and an odd one on a pixel's middle, so its round cap covers
 * whole pixels. A series' points draw as one path of zero-length subpaths, `M x y h0` each, whose
 * round caps are the dots, so 100 000 points cost one element per series.
 */
import {
  curveBasis,
  curveBumpX,
  curveLinear,
  curveMonotoneX,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
  line,
} from "d3-shape";
import type { CurveFactory } from "d3-shape";

import type { ChartCurve } from "../chart-types";
import { devicePixel } from "./plot-frame";
import type { PlotBox } from "./plot-frame";
import { pathNumber } from "./rounding";

/** The plot box under the x and y domains. */
export type ScatterFrame = {
  readonly box: PlotBox;
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
};

/** A point in CSS pixels from the plot's top left. */
export type PlotPoint = { readonly x: number; readonly y: number };

/**
 * The curves `ScatterChart.Line` takes: `ChartCurve` without "monotone-y", which has no meaning over
 * an x-sorted series.
 *
 * @beta
 */
export type ScatterCurve = Exclude<ChartCurve, "monotone-y">;

/**
 * Where an x value lands, in CSS pixels from the plot's left edge, unsnapped.
 *
 * @param frame - The frame.
 * @param value - The x value.
 * @returns The coordinate.
 */
export function frameX(frame: ScatterFrame, value: number): number {
  const [low, high] = frame.x;
  return high === low ? frame.box.width / 2 : ((value - low) / (high - low)) * frame.box.width;
}

/**
 * Where a y value lands, in CSS pixels from the plot's top edge, unsnapped.
 *
 * @param frame - The frame.
 * @param value - The y value.
 * @returns The coordinate.
 */
export function frameY(frame: ScatterFrame, value: number): number {
  const [low, high] = frame.y;
  return high === low ? frame.box.height / 2 : (1 - (value - low) / (high - low)) * frame.box.height;
}

/**
 * A dot's diameter, rounded to whole device pixels and at least one.
 *
 * @param box - The plot box.
 * @param size - The diameter in CSS pixels.
 * @returns The diameter in CSS pixels.
 */
export function dotDiameter(box: PlotBox, size: number): number {
  return Math.max(1, Math.round(size * box.dpr)) / box.dpr;
}

/**
 * The snapping one axis of a dot takes: the layer's origin in device pixels, the device-pixel
 * ratio and the half-pixel shift an odd diameter needs.
 */
type AxisSnap = { readonly origin: number; readonly dpr: number; readonly shift: number };

function axisSnap(box: PlotBox, edge: number, diameter: number): AxisSnap {
  const odd = Math.round(diameter * box.dpr) % 2 === 1;
  return { origin: devicePixel(box.dpr, edge), dpr: box.dpr, shift: odd ? 0.5 / box.dpr : 0 };
}

/**
 * Snap a coordinate measured from the layer's origin to the device pixel edge the browser gives a
 * box edge at its page position, as `plot-frame.ts` snaps every cartesian mark.
 */
function snapped(snap: AxisSnap, edge: number, at: number): number {
  return (devicePixel(snap.dpr, edge + at) - snap.origin) / snap.dpr + snap.shift;
}

/**
 * Where a dot's centre lands: on whole device pixels from the layer's origin, half a device pixel
 * past them for a dot an odd number of device pixels across.
 *
 * @param frame - The frame.
 * @param x - The x value.
 * @param y - The y value.
 * @param diameter - The dot's diameter, as `dotDiameter` rounds it.
 * @returns The centre in CSS pixels from the plot's top left.
 */
export function dotCentre(frame: ScatterFrame, x: number, y: number, diameter: number): PlotPoint {
  const { box } = frame;
  return {
    x: snapped(axisSnap(box, box.left, diameter), box.left, frameX(frame, x)),
    y: snapped(axisSnap(box, box.top, diameter), box.top, frameY(frame, y)),
  };
}

/**
 * One series' dots as a path of zero-length subpaths, built in one pass over its typed arrays.
 *
 * @param frame - The frame.
 * @param xs - The series' x values.
 * @param ys - The series' y values.
 * @param diameter - The dots' diameter, as `dotDiameter` rounds it.
 * @returns The path data, empty for no point.
 */
export function pointsPath(
  frame: ScatterFrame,
  xs: Float64Array,
  ys: Float64Array,
  diameter: number
): string {
  const { box } = frame;
  const snapX = axisSnap(box, box.left, diameter);
  const snapY = axisSnap(box, box.top, diameter);
  const [x0, x1] = frame.x;
  const [y0, y1] = frame.y;
  const scaleX = x1 === x0 ? 0 : box.width / (x1 - x0);
  const scaleY = y1 === y0 ? 0 : box.height / (y1 - y0);
  const middleX = x1 === x0 ? box.width / 2 : 0;
  const middleY = y1 === y0 ? box.height / 2 : 0;
  let path = "";
  for (let index = 0; index < xs.length; index += 1) {
    const along = middleX + ((xs[index] ?? 0) - x0) * scaleX;
    const down = y1 === y0 ? middleY : box.height - ((ys[index] ?? 0) - y0) * scaleY;
    path += `M${pathNumber(snapped(snapX, box.left, along))} ${pathNumber(snapped(snapY, box.top, down))}h0`;
  }
  return path;
}

/**
 * The d3 curve of a scatter curve, along x, which a scatter Line and a live line draw through.
 *
 * @param curve - The curve.
 * @returns The d3-shape curve factory.
 */
export function curveAlongX(curve: ScatterCurve): CurveFactory {
  switch (curve) {
    case "linear":
      return curveLinear;
    case "monotone":
      return curveMonotoneX;
    case "natural":
      return curveNatural;
    case "step":
      return curveStep;
    case "step-before":
      return curveStepBefore;
    case "step-after":
      return curveStepAfter;
    case "bump":
      return curveBumpX;
    case "basis":
      return curveBasis;
  }
}

/**
 * One series' points joined in x order, ties by y, through a d3-shape curve. Each vertex snaps to
 * a device pixel edge, where a stroke an even number of device pixels wide, as the default 2 px
 * stroke is, draws a straight run sharp.
 *
 * @param frame - The frame.
 * @param xs - The series' x values, sorted.
 * @param ys - The series' y values.
 * @param curve - The curve.
 * @returns The path data, empty for fewer than two points.
 */
export function linePath(
  frame: ScatterFrame,
  xs: Float64Array,
  ys: Float64Array,
  curve: ScatterCurve
): string {
  if (xs.length < 2) return "";
  const { box } = frame;
  const snapX = axisSnap(box, box.left, 0);
  const snapY = axisSnap(box, box.top, 0);
  const generator = line<number>()
    .x((index) => snapped(snapX, box.left, frameX(frame, xs[index] ?? 0)))
    .y((index) => snapped(snapY, box.top, frameY(frame, ys[index] ?? 0)))
    .curve(curveAlongX(curve))
    .digits(3);
  return generator(Array.from({ length: xs.length }, (_, index) => index)) ?? "";
}

/** A reference line's form: a y, an x, or a segment from one point to another. */
export type ReferenceForm =
  | { readonly y: number; readonly x?: undefined; readonly from?: undefined; readonly to?: undefined }
  | { readonly x: number; readonly y?: undefined; readonly from?: undefined; readonly to?: undefined }
  | {
      readonly from: readonly [number, number];
      readonly to: readonly [number, number];
      readonly x?: undefined;
      readonly y?: undefined;
    };

/** Two points in data values. */
export type DataSegment = readonly [readonly [number, number], readonly [number, number]];

/**
 * A reference line's part inside the domains, in data values: a y line or an x line across the
 * whole domain, and a segment clipped to its edges, Liang and Barsky's way. A line wholly outside
 * has no part, so it draws nothing, label included.
 *
 * @param form - The reference's form.
 * @param domains - The x and y domains the plot draws under.
 * @returns The two ends, or null when no part lies inside.
 */
export function referenceInDomains(
  form: ReferenceForm,
  domains: { readonly x: readonly [number, number]; readonly y: readonly [number, number] }
): DataSegment | null {
  const [x0, x1] = [Math.min(...domains.x), Math.max(...domains.x)];
  const [y0, y1] = [Math.min(...domains.y), Math.max(...domains.y)];
  if (form.y !== undefined) {
    return form.y < y0 || form.y > y1
      ? null
      : [
          [x0, form.y],
          [x1, form.y],
        ];
  }
  if (form.x !== undefined) {
    return form.x < x0 || form.x > x1
      ? null
      : [
          [form.x, y0],
          [form.x, y1],
        ];
  }
  const [fx, fy] = form.from;
  const dx = form.to[0] - fx;
  const dy = form.to[1] - fy;
  let enter = 0;
  let leave = 1;
  // Each edge as p · t ≤ q: left, right, bottom, top.
  for (const [p, q] of [
    [-dx, fx - x0],
    [dx, x1 - fx],
    [-dy, fy - y0],
    [dy, y1 - fy],
  ] as const) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter > leave) return null;
  }
  return [
    [fx + enter * dx, fy + enter * dy],
    [fx + leave * dx, fy + leave * dy],
  ];
}
