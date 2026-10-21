// The order and the cap every option list shares: a value submenu, quick search and the chip's
// option editor. Pure functions the parts call while rendering.

import type { FilterOption, MultiOptionFilterField, OptionFilterField } from "./filter-fields";

/**
 * The most option rows a list renders. An option field may hold thousands of options, and Base
 * UI's menus and comboboxes mount every row they render, so a list shows its first matches and
 * asks for more typing. On a 3,000-option field with the CPU slowed 4x, a keystroke took 28ms at
 * 50 rows, 42ms at 100, 75ms at 200 and 942ms uncapped. 50 rows stay inside a 50ms input budget.
 */
export const OPTION_LIMIT = 50;

/** A list's order while it is open: the values picked when it opened, then the rest. */
export type OptionOrder = {
  readonly pinned: readonly FilterOption[];
  readonly rest: readonly FilterOption[];
};

/**
 * Takes a list's order once, when the list mounts. Picked values come first in config order,
 * then the rest in config order, or by count with the highest first when the field sets
 * `order: "count"`. Equal counts keep config order. A tick never moves a row while the list is
 * open.
 *
 * @param field - The option field.
 * @param picked - The values picked as the list opens.
 * @param counts - The option counts, when known.
 * @returns The order.
 */
export function snapshotOrder(
  field: OptionFilterField | MultiOptionFilterField,
  picked: readonly string[],
  counts: ReadonlyMap<string, number> | undefined
): OptionOrder {
  const pinned = field.options.filter((option) => picked.includes(option.value));
  const rest = field.options.filter((option) => !picked.includes(option.value));
  if (field.order !== "count" || counts === undefined) {
    return { pinned, rest };
  }
  // `toSorted` is stable, so equal counts keep their config order.
  return {
    pinned,
    rest: rest.toSorted((left, right) => (counts.get(right.value) ?? 0) - (counts.get(left.value) ?? 0)),
  };
}

/** The rows a list renders for a query. */
export type OptionMatches = {
  readonly pinned: readonly FilterOption[];
  readonly rest: readonly FilterOption[];
  /** More options match than the list shows, so it shows its "type to narrow" row. */
  readonly more: boolean;
};

/**
 * Walks the order and keeps the first `limit` options whose label contains the query, stopping
 * at the first match past the limit. An empty query matches every option.
 *
 * @param order - The list's order.
 * @param query - The search text.
 * @param contains - The locale's matcher.
 * @param limit - The most rows to keep.
 * @returns The rows to render and whether more match.
 */
export function matchOptions(
  order: OptionOrder,
  query: string,
  contains: (text: string, query: string) => boolean,
  limit: number
): OptionMatches {
  const needle = query.trim();
  const pinned: FilterOption[] = [];
  const rest: FilterOption[] = [];
  let shown = 0;
  for (const [list, into] of [
    [order.pinned, pinned],
    [order.rest, rest],
  ] as const) {
    for (const option of list) {
      if (needle !== "" && !contains(option.label, needle)) {
        continue;
      }
      if (shown === limit) {
        return { pinned, rest, more: true };
      }
      into.push(option);
      shown += 1;
    }
  }
  return { pinned, rest, more: false };
}
