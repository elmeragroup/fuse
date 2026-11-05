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

/** The families whose entrance staggers its items, and the clock, whose writers stagger its slots. */
export type PolarIntro = "pie" | "radial" | "radar" | "clock";

/**
 * The clock entrance, the Motion table's numbers: one progress over 1250 ms opens a clockwise wedge
 * over its first 750 ms, and each slot rises from its base over 500 ms on an ease-out cubic from the
 * moment the wedge reaches the slot's start.
 */
export const CLOCK_INTRO = { span: 1250, wedge: 750, rise: 500 } as const;

/**
 * How an item's entrance runs: over `--chart-intro` on the update curve, or for the clock over its
 * whole span at a steady pace, which its writers ease slot by slot.
 *
 * @param family - The family.
 * @returns The entrance's duration in milliseconds and its curve.
 */
export function introTiming(family: PolarIntro): { readonly duration: number; readonly curve?: "linear" } {
  return family === "clock" ? { duration: CLOCK_INTRO.span, curve: "linear" } : { duration: CHART_INTRO_MS };
}

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
    case "clock":
      return 0;
  }
}

/**
 * The radar grid's entrance, the Motion table's numbers: rings scale out 80 ms apart, spokes extend
 * 50 ms apart, and spoke labels fade in over 500 ms from 400 ms, 50 ms apart. `chart.css` writes
 * the same numbers on the grid's scale-outs and the labels' fade.
 */
export const RADAR_GRID_INTRO = {
  ringStep: 80,
  spokeStep: 50,
  labelStart: 400,
  labelStep: 50,
  labelFade: 500,
} as const;

/** What an entrance's span reads: the family, its staggered items, and a radar's rings and spokes. */
export type EntranceItems = {
  readonly family: PolarIntro;
  /** The slices, the rings, or a radar's series. */
  readonly items: number;
  /** A radar's rings, 0 otherwise. */
  readonly rings: number;
  /** A radar's spokes, 0 otherwise. */
  readonly spokes: number;
};

/**
 * How long an entrance runs from its start until its last item rests, in milliseconds: the last
 * item's delay plus `--chart-intro`, or for a radar the last ring's, spoke's or label's end if one
 * ends later.
 *
 * @param entrance - The family and its counts.
 * @param springs - The settle times of the rings' `grow` and the spokes' `extend` springs.
 * @returns The span.
 */
export function entranceSpan(
  entrance: EntranceItems,
  springs: { readonly grow: number; readonly extend: number }
): number {
  if (entrance.family === "clock") return CLOCK_INTRO.span;
  const items = CHART_INTRO_MS + introDelay(entrance.family, Math.max(0, entrance.items - 1));
  if (entrance.family !== "radar") return items;
  const { ringStep, spokeStep, labelStart, labelStep, labelFade } = RADAR_GRID_INTRO;
  const last = (count: number, step: number): number => Math.max(0, count - 1) * step;
  return Math.max(
    items,
    last(entrance.rings, ringStep) + springs.grow,
    last(entrance.spokes, spokeStep) + springs.extend,
    labelStart + last(entrance.spokes, labelStep) + labelFade
  );
}
