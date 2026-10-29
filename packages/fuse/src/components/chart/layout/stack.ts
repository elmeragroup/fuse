/**
 * Stacks of series that share a `stack` id, as CONTRACT section 8.2 and section 8.15 define them.
 * d3-shape's diverging offset places each slot's positive parts upward from 0 and its negative
 * parts downward, in series order. The expand offset divides each slot by the sum of its parts'
 * magnitudes first, so a slot with both signs keeps them apart and no share exceeds 100 %.
 */
import { stack, stackOffsetDiverging } from "d3-shape";

/** How a stack places its parts. */
export type StackOffset = "diverging" | "expand";

/** One part's extent at one slot, lower end first, or null when the part has no reading there. */
export type Extent = readonly [low: number, high: number] | null;

/** The result of stacking one group of series. */
export type StackResult = {
  /** Each series' extents, in the order of the input series, one per slot. */
  readonly extents: readonly (readonly Extent[])[];
  /** The slots where an expand stack met both signs, which `mixed-sign-expand` reports. */
  readonly mixedSignSlots: readonly number[];
};

/**
 * Stack series slot by slot.
 *
 * A null reading adds 0, so the other parts keep their place, and its extent is null so the
 * segment draws nothing. Under `"expand"` a slot whose parts sum to 0 in magnitude gives every
 * part a zero-height extent at 0.
 *
 * @param series - Each series' readings, one per slot, in stack order. Every list has the same length.
 * @param offset - The offset rule.
 * @returns Each series' extents and the slots with both signs under `"expand"`.
 */
export function stackSeries(
  series: readonly (readonly (number | null)[])[],
  offset: StackOffset
): StackResult {
  const slotCount = series[0]?.length ?? 0;
  const slots = Array.from({ length: slotCount }, (_, index) => index);
  const mixedSignSlots: number[] = [];
  const scales = slots.map((slot) => {
    if (offset === "diverging") return 1;
    let magnitude = 0;
    let positive = false;
    let negative = false;
    for (const values of series) {
      const value = values[slot] ?? 0;
      magnitude += Math.abs(value);
      positive ||= value > 0;
      negative ||= value < 0;
    }
    if (positive && negative) mixedSignSlots.push(slot);
    return magnitude === 0 ? 0 : 1 / magnitude;
  });
  const scaled = series.map((values) => values.map((value, slot) => (value ?? 0) * (scales[slot] ?? 1)));
  const stacked = stack<number, number>()
    .keys(scaled.map((_, index) => index))
    .value((slot, key) => scaled[key]?.[slot] ?? 0)
    .offset(stackOffsetDiverging)(slots);
  // d3's diverging offset already writes each extent lower end first.
  const extents = stacked.map((points, key) =>
    points.map((point, slot): Extent => (series[key]?.[slot] === null ? null : [point[0], point[1]]))
  );
  return { extents, mixedSignSlots };
}
