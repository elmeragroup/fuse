/**
 * The series nearest the pointer at one slot, as CONTRACT section 9.5 defines it. The pick reads
 * the layout's config keys, never the marks a consumer wrote, so a BarGroup changes no pick.
 */

/**
 * Pick the series whose drawn value lies nearest a value-axis position. A stacked key's drawn
 * value is its stack end away from zero. Keys with no reading at the slot are skipped, and a tie
 * goes to the earlier key in config order. A layout with one key picks nothing, because there is
 * nothing to choose between.
 *
 * @param drawn - Each key's drawn value at the slot in config order, null without a reading.
 * @param position - The pointer's position in value units.
 * @returns The index of the nearest key, or -1.
 */
export function nearestSeries(drawn: readonly (number | null)[], position: number): number {
  if (drawn.length < 2) return -1;
  let best = -1;
  let distance = Number.POSITIVE_INFINITY;
  drawn.forEach((value, index) => {
    if (value === null) return;
    const gap = Math.abs(value - position);
    if (gap < distance) {
      best = index;
      distance = gap;
    }
  });
  return best;
}
