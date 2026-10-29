/**
 * Band and point scales over slot indexes, after d3-scale 4.0.2's `scaleBand` and `scalePoint`.
 * A chart's x domain is a list of slots, so the scale takes a slot count, not a list of values.
 * The plot draws in fractions of its own box, so the range is usually `[0, 1]` and CSS turns it
 * into percentages, which keeps the server render free of any measured width.
 */

/** How a band scale divides its range. Every field follows the d3-scale option of the same name. */
export type BandOptions = {
  /** The number of slots. */
  readonly count: number;
  /** The range the slots divide, in plot units. A reversed pair places the first slot at the end. */
  readonly range: readonly [number, number];
  /** The fraction of each step left empty between bands, clamped to at most 1. */
  readonly paddingInner?: number;
  /** The empty space before the first band and after the last one, in steps. */
  readonly paddingOuter?: number;
  /** Where the bands sit in the leftover range, from 0 at the start to 1 at the end. */
  readonly align?: number;
  /** Whether to floor the step and round the start and the bandwidth to whole units. */
  readonly round?: boolean;
};

/** A band scale's measured layout. */
export type BandScale = {
  /** The distance from one band's start to the next band's start. */
  readonly step: number;
  /** The width of one band. */
  readonly bandwidth: number;
  /** The start of each band, in slot order. */
  readonly starts: readonly number[];
};

/**
 * Lay out `count` bands across a range, as d3-scale's band scale does.
 *
 * @param options - The slot count, the range and the padding.
 * @returns The step, the bandwidth and every band's start.
 */
export function bandScale(options: BandOptions): BandScale {
  const { count, range, round = false } = options;
  const paddingInner = Math.min(1, options.paddingInner ?? 0);
  const paddingOuter = options.paddingOuter ?? 0;
  const align = Math.max(0, Math.min(1, options.align ?? 0.5));
  const [r0, r1] = range;
  const reverse = r1 < r0;
  let start = reverse ? r1 : r0;
  const stop = reverse ? r0 : r1;
  let step = (stop - start) / Math.max(1, count - paddingInner + paddingOuter * 2);
  if (round) step = Math.floor(step);
  start += (stop - start - step * (count - paddingInner)) * align;
  let bandwidth = step * (1 - paddingInner);
  if (round) {
    start = Math.round(start);
    bandwidth = Math.round(bandwidth);
  }
  const starts = Array.from({ length: count }, (_, index) => start + step * index);
  return { step, bandwidth, starts: reverse ? starts.reverse() : starts };
}

/** How a point scale spaces its points. */
export type PointOptions = {
  /** The number of slots. */
  readonly count: number;
  /** The range the points span, in plot units. */
  readonly range: readonly [number, number];
  /** The empty space before the first point and after the last one, in steps. */
  readonly padding?: number;
  /** Where the points sit in the leftover range, from 0 at the start to 1 at the end. */
  readonly align?: number;
  /** Whether to floor the step and round the start to whole units. */
  readonly round?: boolean;
};

/**
 * Space `count` points across a range, as d3-scale's point scale does. A point scale is a band
 * scale whose bands have no width, so a line's first and last vertices reach the range ends.
 *
 * @param options - The slot count, the range and the outer padding.
 * @returns The step, a bandwidth of 0 and every point's position.
 */
export function pointScale(options: PointOptions): BandScale {
  return bandScale({
    count: options.count,
    range: options.range,
    paddingInner: 1,
    paddingOuter: options.padding ?? 0,
    align: options.align ?? 0.5,
    round: options.round ?? false,
  });
}

/**
 * The slot whose centre lies nearest a position along the scale's range. Centres are evenly
 * spaced, so the pick is arithmetic. Each cell is half-open, so a position exactly between two
 * centres picks the later slot.
 *
 * @param scale - A band or point scale over at least one slot.
 * @param position - The position in the scale's range units.
 * @returns The nearest slot index, clamped to the scale's slots.
 */
export function nearestIndex(scale: BandScale, position: number): number {
  const count = scale.starts.length;
  const [first, second] = scale.starts;
  // A scale of one slot or none has nothing to pick between.
  if (first === undefined || second === undefined) return 0;
  // A reversed range runs the starts downward, and the signed step keeps the arithmetic one rule.
  const signedStep = second - first;
  const raw = Math.floor((position - first - scale.bandwidth / 2) / signedStep + 0.5);
  return Math.max(0, Math.min(count - 1, raw));
}
