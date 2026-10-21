// The rows, order and cap every value list shares: a value submenu, quick search and the chip's
// option editor. Pure functions the parts call while rendering.

import type { BooleanFilterField, FilterFieldOfKind, FilterOption } from "./filter-fields";
import type { FilterKind, FilterValue } from "./filter-model";

/**
 * The kinds whose values a list offers. A list commits on each pick, while every other kind edits
 * a draft that settles into one write.
 */
export const LIST_KINDS = ["option", "multiOption", "boolean"] as const;

/** A kind whose values a list offers. */
export type ListKind = (typeof LIST_KINDS)[number];

/** A field whose values a list offers: an option, multi-option or boolean field. */
export type ListField = FilterFieldOfKind<ListKind>;

/**
 * Whether a kind's values come from a list.
 *
 * @param kind - The kind.
 * @returns Whether it is an option, multi-option or boolean kind.
 */
export function isListKind(kind: FilterKind): kind is ListKind {
  const kinds: readonly FilterKind[] = LIST_KINDS;
  return kinds.includes(kind);
}

/**
 * Whether a field's values come from a list. A filter narrows the same way, by its kind.
 *
 * @param field - The field, or its filter.
 * @returns Whether it is an option, multi-option or boolean field.
 */
export function isListField<T extends { readonly kind: FilterKind }>(
  field: T
): field is Extract<T, { readonly kind: ListKind }> {
  return isListKind(field.kind);
}

/** The dictionary's names for a boolean's values, for a field that names none. */
export type BooleanLabels = { readonly yes: string; readonly no: string };

/**
 * A boolean value's name: the field's own label for it, else the dictionary's.
 *
 * @param field - The field's labels, empty for a field that names none.
 * @param value - The value.
 * @param labels - The dictionary's yes and no.
 * @returns The name.
 */
export function booleanLabel(
  field: Pick<BooleanFilterField, "trueLabel" | "falseLabel">,
  value: boolean,
  labels: BooleanLabels
): string {
  return value ? (field.trueLabel ?? labels.yes) : (field.falseLabel ?? labels.no);
}

/** What a list's order reads: its options and, for an option field, its `order`. */
export type ListSource = {
  readonly options: readonly FilterOption[];
  readonly order?: "options" | "count" | undefined;
};

/**
 * The values a list field offers, and their order. A boolean field offers `"true"` and `"false"`
 * in that order, named by its own labels or the dictionary's. A toggle offers only `"true"`, since
 * off is no filter.
 *
 * @param field - The list field.
 * @param labels - The dictionary's yes and no.
 * @returns The list's options and order.
 */
export function listSource(field: ListField, labels: BooleanLabels): ListSource {
  if (field.kind !== "boolean") {
    return field;
  }
  const yes = { value: "true", label: booleanLabel(field, true, labels) };
  return {
    options:
      field.toggle === true ? [yes] : [yes, { value: "false", label: booleanLabel(field, false, labels) }],
  };
}

/**
 * The option values a list field's filter picks. A boolean's value reads as `"true"` or `"false"`.
 *
 * @param field - The list field.
 * @param filter - The field's filter, if any.
 * @returns The picked values, none for a filter of another kind.
 */
export function pickedValues(field: ListField, filter: FilterValue | undefined): readonly string[] {
  if (filter?.kind !== field.kind) {
    return [];
  }
  return filter.kind === "boolean" ? [String(filter.values[0])] : filter.values;
}

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
 * @param source - The list's options and order, such as an option field.
 * @param picked - The values picked as the list opens.
 * @param counts - The option counts, when known.
 * @returns The order.
 */
export function snapshotOrder(
  source: ListSource,
  picked: readonly string[],
  counts: ReadonlyMap<string, number> | undefined
): OptionOrder {
  const pinned = source.options.filter((option) => picked.includes(option.value));
  const rest = source.options.filter((option) => !picked.includes(option.value));
  if (source.order !== "count" || counts === undefined) {
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
