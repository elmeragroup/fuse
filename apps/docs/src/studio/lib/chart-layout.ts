/** The multiples a chart's axis ceiling lands on, within each power of ten. */
const NICE_STEPS = [1, 2, 5, 10] as const;

/**
 * The smallest 1, 2 or 5 times a power of ten that is at least `value`, so the axis ends on a
 * round number. A series of zeros gets an axis of 1.
 */
export function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  const step = NICE_STEPS.find((multiple) => multiple * power >= value * (1 - 1e-9)) ?? 10;
  // Rounded to the power's own precision, so 0.1 does not come back as 0.10000000000000002.
  return Number((step * power).toPrecision(12));
}

/** `count + 1` evenly spaced ticks from 0 to `ceiling`. */
export function chartTicks(ceiling: number, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, index) => Number(((ceiling * index) / count).toPrecision(12)));
}

/** `value` as a percentage of the axis `ceiling`: a bar's height. */
export function shareOf(value: number, ceiling: number): number {
  return (value / ceiling) * 100;
}
