/**
 * Package-private rule that keeps Base UI's highlight usable in a virtual list. Base UI runs
 * Enter by clicking the highlighted row's element, so the row must stay mounted.
 */

/**
 * The rows to render: the virtualizer's window, plus the highlighted row when it lies outside it,
 * so Enter still finds the row after a wheel scroll moved it out of view.
 *
 * @param indexes - The window's indexes in ascending order.
 * @param highlighted - The highlighted row's index, or `undefined` when nothing is highlighted.
 * @param count - How many items the filtered list holds.
 * @returns The indexes to render, in ascending order.
 */
export function withHighlightedRow(
  indexes: readonly number[],
  highlighted: number | undefined,
  count: number
): number[] {
  if (highlighted === undefined || highlighted < 0 || highlighted >= count || indexes.includes(highlighted)) {
    return [...indexes];
  }
  return [...indexes, highlighted].toSorted((left, right) => left - right);
}
