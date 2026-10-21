// Untrusted input, such as a URL or a request body, to filter state. It drops what the field
// config does not admit instead of throwing, so a stale link degrades to fewer filters.

import type { FilterFieldMap } from "./filter-fields";
import type { DataTableFilterEntry, FilterValue } from "./filter-model";
import { fieldAdmits, isFilterValue, isString } from "./filter-model";

/**
 * Parses `columnFilters` from untrusted input. An entry stays only when its id is a field, its
 * value is well formed for that field's kind and its operator is one the field allows, and every
 * option value is one of the field's options. The first entry per id wins, and input that is not
 * an array gives no filters.
 *
 * @param input - The parsed JSON, of any shape.
 * @param fields - The fields map.
 * @returns The filters the fields admit.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary: a URL, a request body or TanStack's untyped state
export function parseColumnFilters(input: unknown, fields: FilterFieldMap): DataTableFilterEntry[] {
  return parseEntries(input, fields, fieldAdmits);
}

/**
 * Reads the table's own `columnFilters` for the Root's view. An entry stays when its id is a
 * field and its value is well formed for that field's kind, whatever the field's current options
 * and operators say, so a filter applied before the config changed stays visible and removable
 * while TanStack keeps applying it.
 *
 * @param input - The table's `columnFilters`.
 * @param fields - The fields map.
 * @returns The filters of the fields' kinds.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- TanStack types each entry's value as unknown
export function viewColumnFilters(input: unknown, fields: FilterFieldMap): DataTableFilterEntry[] {
  return parseEntries(input, fields, (field, value) => field.kind === value.kind);
}

function parseEntries(
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- the shared walk over untyped input
  input: unknown,
  fields: FilterFieldMap,
  keeps: (field: FilterFieldMap[string], value: FilterValue) => boolean
): DataTableFilterEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const entries: DataTableFilterEntry[] = [];
  const list: readonly unknown[] = input;
  for (const entry of list) {
    if (!(entry instanceof Object) || !("id" in entry && "value" in entry)) {
      continue;
    }
    const { id, value } = entry;
    if (!isString(id) || seen.has(id) || !Object.hasOwn(fields, id)) {
      continue;
    }
    const field = fields[id];
    if (field === undefined || !isFilterValue(value) || !keeps(field, value)) {
      continue;
    }
    seen.add(id);
    entries.push({ id, value });
  }
  return entries;
}
