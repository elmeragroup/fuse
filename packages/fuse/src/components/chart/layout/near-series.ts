/**
 * Which series a pointer is nearest on a radar spoke or a clock slot, with hysteresis: the series
 * the pointer holds stays until another lies nearer by more than `NEAR_HOLD` of the outer radius,
 * so two close series never flicker under a moving pointer (MOTION-REVIEW Fix R2.6).
 */

/** How much nearer, in units of the outer radius, another series must be to take over: about 6 px on a 100 px dial. */
export const NEAR_HOLD = 0.06;

/**
 * The nearest series by its gap from the pointer, keeping the held one unless another is nearer by
 * more than `NEAR_HOLD`. Among the others a tie goes to the earlier series.
 *
 * @param gaps - Each series' distance from the pointer in units of the outer radius, null where it
 *   has no reading.
 * @param held - The series the pointer holds, or null.
 * @param firm - Whether the held series stays whatever lies nearer, as it does for a moment after
 *   it changed, so three series a fast pointer crosses never flicker the dims.
 * @returns The series' index, or null when none has a reading.
 */
export function nearestHeld(
  gaps: readonly (number | null)[],
  held: number | null,
  firm = false
): number | null {
  let best: number | null = null;
  let distance = Number.POSITIVE_INFINITY;
  gaps.forEach((gap, index) => {
    if (gap !== null && gap < distance) {
      best = index;
      distance = gap;
    }
  });
  const own = held === null ? null : (gaps[held] ?? null);
  return own !== null && (firm || own - distance <= NEAR_HOLD) ? held : best;
}
