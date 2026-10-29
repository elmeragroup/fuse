/**
 * A linear scale over two values, after d3-scale 4.0.2's `scaleLinear`. Its arithmetic follows
 * d3's own normalise and interpolate steps, and d3's test vectors judge every mapped double. Ticks come
 * from d3-array, the release whose test vectors judge this module.
 */
import { nice, ticks } from "d3-array";

/** A linear map from a value domain to a range. */
export type LinearScale = {
  /** The two domain ends, in the order given. */
  readonly domain: readonly [number, number];
  /** The two range ends, in the order given. */
  readonly range: readonly [number, number];
  /** Whether values outside the domain map to the nearest range end. */
  readonly clamp: boolean;
};

/**
 * Build a linear scale.
 *
 * @param domain - The two domain ends.
 * @param range - The two range ends.
 * @param options - `clamp` keeps every mapped value inside the range.
 * @returns The scale.
 */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
  options: { readonly clamp?: boolean } = {}
): LinearScale {
  return { domain, range, clamp: options.clamp ?? false };
}

/** d3's normalise step. An empty domain maps every value to the middle of the range. */
function normalize(a: number, b: number): (x: number) => number {
  const span = b - a;
  if (span !== 0 && !Number.isNaN(span)) return (x) => (x - a) / span;
  const middle = Number.isNaN(span) ? Number.NaN : 0.5;
  return () => middle;
}

/** d3's number interpolator, written as d3 writes it so the doubles agree. */
function interpolate(a: number, b: number): (t: number) => number {
  return (t) => a * (1 - t) + b * t;
}

function piecewise(from: readonly [number, number], to: readonly [number, number]): (x: number) => number {
  const [d0, d1] = from;
  const [r0, r1] = to;
  const t = normalize(d0, d1);
  const r = interpolate(r0, r1);
  return (x) => r(t(x));
}

function clamper(a: number, b: number): (x: number) => number {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return (x) => Math.max(low, Math.min(high, x));
}

/**
 * Map a value into the range.
 *
 * @param scale - The scale.
 * @param value - The value. NaN maps to NaN.
 * @returns The range position.
 */
export function scaleValue(scale: LinearScale, value: number): number {
  const input = scale.clamp ? clamper(scale.domain[0], scale.domain[1])(value) : value;
  return piecewise(scale.domain, scale.range)(input);
}

/**
 * Map a range position back to a value.
 *
 * @param scale - The scale.
 * @param position - The range position.
 * @returns The value, clamped to the domain when the scale clamps.
 */
export function invertValue(scale: LinearScale, position: number): number {
  const value = piecewise(scale.range, scale.domain)(position);
  return scale.clamp ? clamper(scale.domain[0], scale.domain[1])(value) : value;
}

/**
 * Extend the domain to whole multiples of the tick step, through d3-array's `nice`, which repeats
 * the step search until the step stops changing.
 *
 * @param scale - The scale.
 * @param count - The tick count the step aims for, 10 by default.
 * @returns A scale with the widened domain, in the domain's original order.
 */
export function niceScale(scale: LinearScale, count = 10): LinearScale {
  const [first, last] = scale.domain;
  const [start, stop] = nice(Math.min(first, last), Math.max(first, last), count);
  return { ...scale, domain: last < first ? [stop, start] : [start, stop] };
}

/**
 * The tick values of the domain, as d3-scale's `ticks` returns them.
 *
 * @param scale - The scale.
 * @param count - The tick count to aim for, 10 by default.
 * @returns The ticks in the domain's order.
 */
export function scaleTicks(scale: LinearScale, count = 10): number[] {
  return ticks(scale.domain[0], scale.domain[1], count);
}
