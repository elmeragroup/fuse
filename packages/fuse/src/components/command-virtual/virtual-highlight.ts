/**
 * Package-private rules that keep Base UI's highlight usable in a virtual list. Base UI moves the
 * highlight by index and runs Enter by clicking the highlighted row's element, so the row must
 * be mounted, and a highlight that jumps past the rendered window must scroll there.
 */

import type { AutocompleteRootHighlightEventReason } from "@base-ui/react";

/**
 * Where to scroll a newly highlighted row, by Base UI's rule for virtual lists: scroll on a
 * programmatic highlight, such as the first match after typing, and on a keyboard highlight that
 * lands on the first or last row, where the arrows wrap. Other keyboard moves step to a mounted
 * neighbour, which Base UI scrolls into view itself.
 *
 * @param reason - Why the highlight moved.
 * @param index - The highlighted row's index in the filtered items.
 * @param count - How many items the filtered list holds.
 * @returns The alignment to scroll the row to, or `undefined` to leave the scroll alone.
 */
export function highlightScrollAlign(
  reason: AutocompleteRootHighlightEventReason,
  index: number,
  count: number
): "start" | "end" | undefined {
  const isStart = index === 0;
  const isEnd = index === count - 1;
  if (reason === "none" || (reason === "keyboard" && (isStart || isEnd))) {
    // Scrolling the last row to the start clamps at the end of the list.
    return isEnd ? "start" : "end";
  }
  return undefined;
}

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
