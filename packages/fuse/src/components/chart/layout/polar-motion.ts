/**
 * The polar families' motion timings, the Motion table's numbers (D17). `chart.css` mirrors the
 * entrance's duration and stagger as `--chart-intro` and `--chart-stagger`.
 */

/** How long the polar entrance moves a mark, in milliseconds. `--chart-intro` in `chart.css`. */
export const CHART_INTRO_MS = 1000;

/** The delay between two items of the entrance, in milliseconds. `--chart-stagger` in `chart.css`. */
export const CHART_INTRO_STAGGER_MS = 80;

/** Where a pie's entrance starts its first slice, in milliseconds after the chart comes into view. */
const PIE_INTRO_START_MS = 100;

/** Where a ring's value starts to sweep, and the step between rings, after its track scales out. */
const RING_INTRO = { start: 160, step: 100 } as const;

/** Where a radar series starts to grow, and the step between series, after its grid draws. */
const RADAR_INTRO = { start: 600, step: 150 } as const;

/** The families whose entrance staggers its items. */
export type PolarIntro = "pie" | "radial" | "radar";

/**
 * When an item's entrance starts: slice i of a pie at 100 + i·80 ms, ring i's value at 160 + i·100
 * ms, and radar series s at 600 + s·150 ms.
 *
 * @param family - The family.
 * @param index - The slice, the ring or the series.
 * @returns The delay in milliseconds.
 */
export function introDelay(family: PolarIntro, index: number): number {
  switch (family) {
    case "pie":
      return PIE_INTRO_START_MS + index * CHART_INTRO_STAGGER_MS;
    case "radial":
      return RING_INTRO.start + index * RING_INTRO.step;
    case "radar":
      return RADAR_INTRO.start + index * RADAR_INTRO.step;
  }
}
