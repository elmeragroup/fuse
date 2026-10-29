/**
 * Value-driven colour, as CONTRACT section 8.9 defines it. A series whose `color` names a scale
 * paints each value with one of 7 steps. The bins read every row of the data, never a brush
 * window, so a colour never shifts while the window moves.
 */

/** The two scales a series colour may name. */
export type ColorScale = "chart-seq" | "chart-diverging";

/** One of a scale's 7 steps. */
export type ColorStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** The steps a value maps to. */
export type ColorBins = (value: number) => ColorStep;

const STEPS: readonly ColorStep[] = [1, 2, 3, 4, 5, 6, 7];

function step(index: number): ColorStep {
  return STEPS[Math.max(0, Math.min(6, index))] ?? 4;
}

/**
 * Build a series' bins from its readings.
 *
 * - `chart-diverging` keeps step 4 for magnitudes below M/7, where M is the largest magnitude in
 *   the series, then steps 3 and 5 below 3M/7, 2 and 6 below 5M/7, and 1 and 7 beyond. Negative
 *   values take the low steps. The bins are symmetric, so x and −x land on mirrored steps.
 * - `chart-seq` splits the series' extent into 7 equal bins, so the lowest value takes step 1 and
 *   the highest step 7.
 * - A flat series, and an all-zero series under either scale, is all step 4.
 *
 * @param scale - The scale the series names.
 * @param values - Every finite reading of the series across the whole data.
 * @returns The value-to-step map.
 */
export function colorBins(scale: ColorScale, values: readonly number[]): ColorBins {
  if (scale === "chart-diverging") {
    let largest = 0;
    for (const value of values) largest = Math.max(largest, Math.abs(value));
    if (largest === 0) return () => 4;
    return (value) => {
      // Comparing 7|v| with M, 3M and 5M keeps each edge exact, where a division would round.
      const scaled = Math.abs(value) * 7;
      const offset = scaled < largest ? 0 : scaled < largest * 3 ? 1 : scaled < largest * 5 ? 2 : 3;
      return step(value < 0 ? 3 - offset : 3 + offset);
    };
  }
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    lo = Math.min(lo, value);
    hi = Math.max(hi, value);
  }
  if (!(hi > lo)) return () => 4;
  return (value) => step(Math.floor(((value - lo) / (hi - lo)) * 7));
}
