/**
 * The value axis of one layout, as CONTRACT section 8.2 and section 8.3 define it. The domain
 * holds the data's extent, 0 under the zero baseline and every `yInclude` value, niced with
 * d3-array's rule for 5 ticks. Flat and near-flat extents widen first, because d3 cannot nice a
 * range of zero width. No bound or tick is ever −0.
 */
import { nice, ticks } from "d3-array";

/** Whether a layout's domain keeps 0. */
export type Baseline = "zero" | "none";

/** The inputs of a value domain. */
export type ValueDomainInput = {
  /** Every drawn value of the layout's series, stack ends included. Non-finite values are skipped. */
  readonly values: Iterable<number>;
  /** `"zero"` keeps 0 in the domain. */
  readonly baseline: Baseline;
  /** Values the domain must reach, such as a price cap. */
  readonly include?: readonly number[];
};

/** A niced value domain and its ticks. */
export type ValueDomain = {
  /** The lower and upper bound. */
  readonly domain: readonly [number, number];
  /** The tick values, lowest first. */
  readonly ticks: readonly number[];
};

/** Every value axis aims for 5 ticks, after Recharts' default and the Figma price chart. */
export const TICK_COUNT = 5;

/**
 * A range narrower than this fraction of its magnitude follows the flat rule. A double carries
 * about 16 significant digits, so closer ticks format as duplicates.
 */
const NARROW = 1e-12;

/**
 * A magnitude below this counts as 0 in the domain. It mirrors the 1e15 upper bound, and below it
 * d3's step search overflows, so a subnormal such as 5e-324 would yield no tick at all.
 */
const TINY = 1e-15;

/** The domain of a layout with no value, `[0, 1]` with d3's ticks. */
export const EMPTY_DOMAIN: ValueDomain = { domain: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };

/** Turn −0 into 0 and leave every other number alone. */
export function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

function niced(lo: number, hi: number): ValueDomain {
  const [start, stop] = nice(lo, hi, TICK_COUNT);
  return {
    domain: [withoutNegativeZero(start), withoutNegativeZero(stop)],
    ticks: ticks(start, stop, TICK_COUNT).map(withoutNegativeZero),
  };
}

/** The flat rule: a tenth of the value's magnitude on each side, or ±1 around 0. */
function flat(value: number): ValueDomain {
  if (value === 0) return niced(-1, 1);
  const spread = Math.abs(value) / 10;
  return niced(value - spread, value + spread);
}

/**
 * Compute a layout's value domain.
 *
 * - With no value and no include, the domain is `[0, 1]`.
 * - Under `"zero"` an all-zero series gives `[0, 1]` with the single tick 0, because zero is a
 *   reading and the baseline sits at the plot bottom.
 * - A flat or near-flat extent under `"none"` widens by a tenth of its magnitude, or to ±1 at 0.
 *
 * @param input - The drawn values, the baseline and the include list.
 * @returns The niced domain and its ticks.
 */
export function valueDomain(input: ValueDomainInput): ValueDomain {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  const take = (raw: number): void => {
    if (!Number.isFinite(raw)) return;
    const value = Math.abs(raw) < TINY ? 0 : raw;
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  };
  for (const value of input.values) take(value);
  for (const value of input.include ?? []) take(value);
  if (lo > hi) return EMPTY_DOMAIN;
  if (input.baseline === "zero") take(0);
  lo = withoutNegativeZero(lo);
  hi = withoutNegativeZero(hi);
  if (lo === 0 && hi === 0 && input.baseline === "zero") return { domain: [0, 1], ticks: [0] };
  // Under "zero" the extent holds 0, so only a "none" extent can be flat or near-flat.
  if (hi - lo <= Math.max(Math.abs(lo), Math.abs(hi)) * NARROW) return flat((lo + hi) / 2);
  return niced(lo, hi);
}
