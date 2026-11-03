/**
 * Shares that a reader adds up, rounded together so they sum to exactly 100 %, as CONTRACT
 * section 8.13 defines them. Rounding each share alone gives 99 % for three equal thirds.
 */

/**
 * Round a set of shares by the largest-remainder method.
 *
 * Each share is a part's magnitude over the sum of every part's magnitude. The method floors every
 * share to `digits` fraction digits, then gives one unit of the last digit to the shares with the
 * largest remainders until the set sums to 100. A tie goes to the earlier part. Signed parts round
 * on their magnitudes and keep their signs.
 *
 * @param parts - The parts, in data order. A null part counts as 0.
 * @param digits - The fraction digits of the printed percentage.
 * @returns Each part's share in percent, or null for every part when the parts sum to 0.
 */
export function roundShares(parts: readonly (number | null)[], digits: number): (number | null)[] {
  const unit = 10 ** digits;
  const total = parts.reduce<number>((sum, part) => sum + Math.abs(part ?? 0), 0);
  if (total === 0) return parts.map(() => null);
  // Rounding the scaled share to nine places first drops float noise such as 49.999999999.
  const scaled = parts.map((part) => Math.round((Math.abs(part ?? 0) / total) * 100 * unit * 1e9) / 1e9);
  const floors = scaled.map((share) => Math.floor(share));
  let missing = 100 * unit - floors.reduce((sum, share) => sum + share, 0);
  const order = scaled
    .map((share, index) => ({ index, remainder: share - (floors[index] ?? 0) }))
    // Array sort is stable, so equal remainders keep data order and the tie goes to the earlier part.
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) {
    if (missing <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    missing -= 1;
  }
  return parts.map((part, index) => {
    const share = (floors[index] ?? 0) / unit;
    return (part ?? 0) < 0 && share > 0 ? -share : share;
  });
}
