/**
 * The geometry of a live line chart: readings on a continuous time axis that scrolls, a window of
 * fixed duration that ends at the chart's clock, and the value domain that fits what the window
 * shows. Every function is pure and reads no clock of its own, so the frame loop in
 * `live-clock.ts` and the server read the same answers for the same inputs.
 *
 * x runs from the window's start at the plot's left edge to its end, the chart's clock, at the right
 * edge, and y runs bottom to top. Positions are unsnapped: the window moves a fraction of a pixel
 * each frame, and snapping would make it judder.
 */
import { area, line } from "d3-shape";

import type { ChartInstant } from "../chart-types";
import type { PropIssue, RowSubjectIssue } from "./errors";
import { pathNumber } from "./rounding";
import { curveAlongX } from "./scatter-frame";
import type { ScatterCurve } from "./scatter-frame";
import { VALUE_LIMIT } from "./value-domain";

/** One reading: its instant in epoch milliseconds and its value. */
export type LivePoint = { readonly time: number; readonly value: number };

/** A reading as the consumer passes it. */
export type LiveRow = { readonly time: ChartInstant; readonly value: number };

/** The readings in time order, with the rows that were skipped and why. */
export type LiveSeries = {
  readonly points: readonly LivePoint[];
  /** The latest value: Root's `value` when it parses, else the latest reading's, or null with none. */
  readonly latest: number | null;
  readonly issues: readonly (RowSubjectIssue | PropIssue)[];
};

/** A time window in epoch milliseconds, `start` before `end`. */
export type LiveWindow = { readonly start: number; readonly end: number };

/** The readings a window shows, as a half-open index range `[first, end)` of the series. */
export type LiveSpan = { readonly first: number; readonly end: number };

/** Whether a value is finite and within ±1e15, the bound every chart value keeps. */
function isBoundedValue(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= VALUE_LIMIT;
}

/**
 * Parse the consumer's readings: a `Date` or epoch-millisecond time and a finite value within
 * ±1e15. A row that breaks either rule is skipped and reported. The rest sort by time, and a feed
 * already in order, as a live feed is, skips the sort. One instant holds one reading: of rows that
 * share a time, the last in row order wins, as a feed that corrects its latest reading sends it
 * again, so a reading's time is its identity everywhere downstream. Root's `value` keeps the same
 * bound, and one that breaks it is reported and gives way to the latest reading's value.
 *
 * @param rows - The consumer's readings.
 * @param value - Root's `value`, or undefined.
 * @returns The parsed series.
 */
export function parseLiveSeries(rows: readonly LiveRow[], value?: number): LiveSeries {
  const points: LivePoint[] = [];
  const issues: (RowSubjectIssue | PropIssue)[] = [];
  let sorted = true;
  for (const [index, row] of rows.entries()) {
    const time = row.time instanceof Date ? row.time.getTime() : row.time;
    if (!Number.isFinite(time)) {
      issues.push({ rule: "invalid-x", row: index, subject: "time" });
      continue;
    }
    if (!isBoundedValue(row.value)) {
      issues.push({ rule: "non-finite-value", row: index, subject: "value" });
      continue;
    }
    const last = points.at(-1);
    if (last !== undefined && time < last.time) sorted = false;
    points.push({ time, value: row.value });
  }
  // Array#sort is stable, so equal times keep their row order and the last of them wins below.
  if (!sorted) points.sort((a, b) => a.time - b.time);
  const unique: LivePoint[] = [];
  for (const point of points) {
    if (unique.at(-1)?.time === point.time) unique[unique.length - 1] = point;
    else unique.push(point);
  }
  // Root's value holds to the readings' bound, and one that breaks it gives way to the latest
  // reading's, so the domain stays finite.
  let latest = unique.at(-1)?.value ?? null;
  if (value !== undefined) {
    if (isBoundedValue(value)) latest = value;
    else issues.push({ rule: "non-finite-live-value", subject: "value" });
  }
  return { points: unique, latest, issues };
}

/**
 * The window of a duration that ends at an instant.
 *
 * @param end - The window's end, the chart's clock.
 * @param duration - The window's length in milliseconds, above 0.
 * @returns The window.
 */
export function windowEndingAt(end: number, duration: number): LiveWindow {
  return { start: end - duration, end };
}

/**
 * Where an instant lands across a window, 0 at its start and 1 at its end, unclamped.
 *
 * @param window - The window.
 * @param time - The instant.
 * @returns The share.
 */
export function timeShare(window: LiveWindow, time: number): number {
  return (time - window.start) / (window.end - window.start);
}

/** The first index whose reading is at or after `time`, or the length past the last. */
function lowerBound(points: readonly LivePoint[], time: number): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((points[middle]?.time ?? 0) < time) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The first index whose reading is after `time`, or the length past the last. */
function upperBound(points: readonly LivePoint[], time: number): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((points[middle]?.time ?? 0) <= time) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * The readings inside a window, both ends included.
 *
 * @param points - The readings in time order.
 * @param window - The window.
 * @returns The index range.
 */
export function visibleSpan(points: readonly LivePoint[], window: LiveWindow): LiveSpan {
  return { first: lowerBound(points, window.start), end: upperBound(points, window.end) };
}

/**
 * The index of an exact instant's reading, the last of equal ones, or -1 when no reading has it.
 *
 * @param points - The readings in time order.
 * @param time - The instant.
 * @returns The index, or -1.
 */
export function indexAt(points: readonly LivePoint[], time: number): number {
  const index = upperBound(points, time) - 1;
  return points[index]?.time === time ? index : -1;
}

/**
 * The reading nearest an instant among a span's, the earlier one on a tie.
 *
 * @param points - The readings in time order.
 * @param span - The readings to pick from.
 * @param time - The instant.
 * @returns The index, or -1 for an empty span.
 */
export function nearestIndex(points: readonly LivePoint[], span: LiveSpan, time: number): number {
  if (span.end <= span.first) return -1;
  const after = Math.min(span.end - 1, Math.max(span.first, lowerBound(points, time)));
  const before = Math.max(span.first, after - 1);
  const gapAfter = Math.abs((points[after]?.time ?? 0) - time);
  const gapBefore = Math.abs((points[before]?.time ?? 0) - time);
  return gapBefore <= gapAfter ? before : after;
}

/**
 * The lowest and highest of the values the line draws through in a window: the span's readings,
 * the reading before the span, whose segment enters at the left edge, and an extra value, such as
 * the line's live tip. The entering segment counts by its outer reading's value, not by where it
 * crosses the edge: the curves a live line draws, monotone, linear, the steps, bump and basis,
 * never leave the range of the readings around them, so the outer reading bounds the segment
 * under every one of them without sampling the curve, at the cost of some headroom while the
 * segment leaves the window.
 *
 * @param points - The readings in time order.
 * @param span - The readings the window shows.
 * @param extra - A value the extent must hold too, or null.
 * @returns The extent, or null when it holds no value.
 */
export function liveExtent(
  points: readonly LivePoint[],
  span: LiveSpan,
  extra: number | null
): readonly [number, number] | null {
  let low = extra ?? Number.POSITIVE_INFINITY;
  let high = extra ?? Number.NEGATIVE_INFINITY;
  for (let index = Math.max(0, span.first - 1); index < span.end; index += 1) {
    const value = points[index]?.value ?? low;
    if (value < low) low = value;
    if (value > high) high = value;
  }
  return low <= high ? [low, high] : null;
}

/**
 * The share of the extent the domain leaves free above its highest value and below its lowest, so
 * the line never touches the plot's top or bottom edge, after Liveline's range margin.
 */
export const LIVE_DOMAIN_PAD = 0.12;

/**
 * The value domain that fits an extent: the extent widened by `LIVE_DOMAIN_PAD` of its span at each
 * end, or for a flat extent, or one too narrow to widen in floating point, by a tenth of its
 * larger magnitude either way, or by 1 at 0, as a Sparkline's flat line, so a flat line sits mid-plot. A live domain is never niced: nice ends
 * would jump a whole tick step as a reading crosses one, where this domain eases with the data.
 *
 * @param extent - The lowest and highest value.
 * @returns The domain.
 */
export function liveDomain(extent: readonly [number, number]): readonly [number, number] {
  const [low, high] = extent;
  const pad = (high - low) * LIVE_DOMAIN_PAD;
  // A span too small to move either end in floating point, such as 1e-7 at 1e9, counts as flat.
  if (low - pad < low && high + pad > high) return [low - pad, high + pad];
  const spread = Math.max(Math.abs(low), Math.abs(high)) / 10;
  if (low - spread < low && high + spread > high) return [low - spread, high + spread];
  // At 0, or so near it that a tenth underflows, the domain reaches 1 past either end.
  return [low - 1, high + 1];
}

/**
 * The tick steps a time axis picks from, in milliseconds, each a whole number of the wall clock's
 * seconds, minutes or hours, so every tick lands on a round time.
 */
export const LIVE_TICK_STEPS = [
  1_000, 2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000,
  3_600_000, 7_200_000, 10_800_000, 21_600_000, 43_200_000, 86_400_000,
] as const;

/**
 * The finest tick step that puts no more than `room` ticks in a window, or the coarsest step when
 * none does.
 *
 * @param duration - The window's length in milliseconds.
 * @param room - The most ticks the axis holds, at least 1.
 * @returns The step in milliseconds.
 */
export function tickStep(duration: number, room: number): number {
  const most = Math.max(1, room);
  return LIVE_TICK_STEPS.find((step) => duration / step <= most) ?? 86_400_000;
}

/**
 * The tick instants inside a window, both ends included: every instant whose wall clock, the
 * instant plus the zone's offset there, is a whole multiple of the step. One offset holds across
 * the window, read where it ends, so a window that spans a daylight-saving change aligns its ticks
 * to the zone's new offset.
 *
 * @param window - The window.
 * @param step - The step in milliseconds.
 * @param offset - The zone's offset from UTC in milliseconds, such as 3 600 000 for CET.
 * @returns The instants in time order.
 */
export function timeTicks(window: LiveWindow, step: number, offset: number): number[] {
  const ticks: number[] = [];
  for (
    let wall = Math.ceil((window.start + offset) / step) * step;
    wall - offset <= window.end;
    wall += step
  ) {
    ticks.push(wall - offset);
  }
  return ticks;
}

/**
 * How opaque a tick is at its place: fully inside, fading over the last `fade` share of the axis at
 * either edge, and gone at the edge itself, so a tick enters at the right as the window reaches it
 * and leaves at the left without a pop, after Liveline's time axis.
 *
 * @param share - The tick's place across the axis.
 * @param fade - The share of the axis each fade spans, above 0.
 * @returns The opacity, from 0 to 1.
 */
export function edgeFade(share: number, fade: number): number {
  return Math.max(0, Math.min(1, share / fade, (1 - share) / fade));
}

/**
 * The curves a live line chart's `Line` and `Area` take: `ScatterCurve` without "natural". Each of
 * them stays within the values of the two readings around every segment, so the readings the
 * window draws bound the line, and the domain that holds them holds the whole curve. A natural
 * spline overshoots its readings, as through 0, 100, 100 and 0, where it peaks near 115, so it
 * would leave a domain fitted to the readings.
 *
 * @beta
 */
export type LiveLineChartCurve = Exclude<ScatterCurve, "natural">;

/** A shown reading or the live tip, which the line runs through. */
export type LiveVertex = LivePoint;

/** The live tip as a frame shows it: the value it eases toward, and the value it shows now. */
export type LiveTip = { readonly target: number; readonly shown: number };

/**
 * The value a reading draws at in a frame. The latest reading on the clock's own instant is the
 * line's end, which the live dot marks, so it draws at the tip's shown value, as a paused chart's
 * first frame, which ends at the latest reading, shows it. Any other reading the clock holds draws
 * at the value it shows on its way, and the rest at their own.
 *
 * @param points - The readings in time order.
 * @param index - The reading's index.
 * @param now - The clock, the window's end.
 * @param tip - The tip, or null with no reading.
 * @param held - The value each gliding reading shows now, by its time.
 * @returns The value, or NaN for an index with no reading.
 */
export function liveValueAt(
  points: readonly LivePoint[],
  index: number,
  now: number,
  tip: LiveTip | null,
  held: ReadonlyMap<number, number>
): number {
  const point = points[index];
  if (point === undefined) return Number.NaN;
  if (tip !== null && index === points.length - 1 && point.time >= now) return tip.shown;
  return held.get(point.time) ?? point.value;
}

/**
 * The vertices a frame's line runs through: the window's readings, led by the last reading before
 * the window so the line enters at the left edge, then the tip at the clock, so the line runs on to
 * the right edge at the latest value. Each reading draws at `liveValueAt`'s value, so a new
 * reading grows out of the last one, a reading that a newer one overtook mid-glide settles from
 * where it showed, and the line always ends on the live dot. A latest reading on the clock's
 * instant is that end itself, so no second vertex lands on its x.
 *
 * @param points - The readings in time order.
 * @param span - The readings the window shows.
 * @param now - The clock, the window's end.
 * @param tip - The tip, or null with no reading.
 * @param held - The value each gliding reading shows now, by its time.
 * @returns The vertices in time order.
 */
export function liveVertices(
  points: readonly LivePoint[],
  span: LiveSpan,
  now: number,
  tip: LiveTip | null,
  held: ReadonlyMap<number, number>
): LiveVertex[] {
  const vertices: LiveVertex[] = [];
  for (let index = Math.max(0, span.first - 1); index < span.end; index += 1) {
    const point = points[index];
    if (point !== undefined)
      vertices.push({ time: point.time, value: liveValueAt(points, index, now, tip, held) });
  }
  const last = vertices.at(-1);
  if (tip === null || last === undefined || span.end !== points.length) return vertices;
  if (now > last.time) vertices.push({ time: now, value: tip.shown });
  return vertices;
}

/** The plot a frame draws in: its box in CSS pixels, its window and its value domain. */
export type LiveGeometry = {
  readonly width: number;
  readonly height: number;
  readonly window: LiveWindow;
  readonly domain: readonly [number, number];
};

/**
 * Where an instant lands, in CSS pixels from the plot's left edge.
 *
 * @param geometry - The plot.
 * @param time - The instant.
 * @returns The coordinate.
 */
export function liveX(geometry: LiveGeometry, time: number): number {
  return timeShare(geometry.window, time) * geometry.width;
}

/**
 * Where a value lands, in CSS pixels from the plot's top edge.
 *
 * @param geometry - The plot.
 * @param value - The value.
 * @returns The coordinate.
 */
export function liveY(geometry: LiveGeometry, value: number): number {
  const [low, high] = geometry.domain;
  return high === low ? geometry.height / 2 : (1 - (value - low) / (high - low)) * geometry.height;
}

/** The digits a live path keeps: a hundredth of a pixel, so a slow scroll still moves the path. */
const LIVE_DIGITS = 2;

/**
 * A coordinate as a live mark writes it, to the hundredth of a pixel its paths keep.
 *
 * @param value - The coordinate in CSS pixels.
 * @returns The rounded coordinate.
 */
export function livePixel(value: number): string {
  return pathNumber(value, LIVE_DIGITS);
}

/**
 * The line through a frame's vertices, along a d3-shape curve.
 *
 * @param geometry - The plot.
 * @param vertices - The vertices in time order.
 * @param curve - The curve.
 * @returns The path data, empty for fewer than two vertices.
 */
export function liveLinePath(
  geometry: LiveGeometry,
  vertices: readonly LiveVertex[],
  curve: LiveLineChartCurve
): string {
  if (vertices.length < 2) return "";
  return (
    line<LiveVertex>()
      .x((vertex) => liveX(geometry, vertex.time))
      .y((vertex) => liveY(geometry, vertex.value))
      .curve(curveAlongX(curve))
      .digits(LIVE_DIGITS)(vertices) ?? ""
  );
}

/**
 * The area under the line through a frame's vertices, closed along the plot's bottom edge.
 *
 * @param geometry - The plot.
 * @param vertices - The vertices in time order.
 * @param curve - The curve.
 * @returns The path data, empty for fewer than two vertices.
 */
export function liveAreaPath(
  geometry: LiveGeometry,
  vertices: readonly LiveVertex[],
  curve: LiveLineChartCurve
): string {
  if (vertices.length < 2) return "";
  return (
    area<LiveVertex>()
      .x((vertex) => liveX(geometry, vertex.time))
      .y0(geometry.height)
      .y1((vertex) => liveY(geometry, vertex.value))
      .curve(curveAlongX(curve))
      .digits(LIVE_DIGITS)(vertices) ?? ""
  );
}
