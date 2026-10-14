/**
 * This package-private rule keeps Base UI's highlight in view in a virtual list. Base UI moves
 * the highlight by index, so when the highlight jumps past the rendered window, the list must
 * scroll to it.
 */

import type { AutocompleteRootHighlightEventReason } from "@base-ui/react";

/**
 * Returns where to scroll a newly highlighted row, by Base UI's rule for virtual lists. The list
 * scrolls on a programmatic highlight, such as the first match after typing, and on a keyboard
 * highlight that lands on the first or last row, where the arrows wrap. Other keyboard moves step
 * to a mounted neighbour, which Base UI scrolls into view itself.
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
