// TanStack's filter function for Fuse's filter values, written as a plain function so the entry
// imports no TanStack runtime. TanStack hands it each entry's untyped `value`, so it parses that
// value before it trusts it.

import { matchesFilter } from "./filter-match";
import type { MatchOptions } from "./filter-match";
import { isFilterValue } from "./filter-model";
import type { FilterValue } from "./filter-model";

/** The row members the filter function reads. */
type FilterRowSource = {
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- TanStack's getValue is untyped per column, and matchesFilter parses the cell
  readonly getValue: (columnId: string) => unknown;
};

/** Whether a row passes the column's filter value. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- TanStack's FilterFn contract passes the raw state value
type FilterRowPredicate = (row: FilterRowSource, columnId: string, filterValue: unknown) => boolean;

/** The member TanStack reads beside the call. */
type FilterFnMembers = {
  /** Drops a value that is missing or malformed, such as one whose last value was removed. */
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- TanStack's FilterFn contract passes the raw state value
  readonly autoRemove: (filterValue: unknown) => boolean;
};

/**
 * A TanStack `FilterFn` that reads Fuse's `{ kind, operator, values }` values. An intersection,
 * so the API reference keeps `autoRemove` beside the call.
 */
export type DataTableFilterFn = FilterRowPredicate & FilterFnMembers;

/**
 * Creates the filter function. Register it once, as `filterFns: { dataTableFilter }` in the
 * table's features and `defaultColumn: { filterFn: "dataTableFilter" }`, and no column definition
 * changes. A row passes a malformed value, which `autoRemove` then drops from state.
 *
 * @param options - The zone date cells compare in. Use the server's zone too.
 * @returns The filter function.
 */
export function createDataTableFilterFn(options: MatchOptions = {}): DataTableFilterFn {
  // TanStack hands every row the same filter object, so each object is parsed once, not per row.
  const parsed = new WeakMap<object, boolean>();
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- TanStack's FilterFn contract passes the raw state value
  const isParsed = (filterValue: unknown): filterValue is FilterValue => {
    // An object from another realm, such as an iframe, fails `instanceof Object`.
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the parse boundary over TanStack's untyped filter value
    if (typeof filterValue !== "object" || filterValue === null) {
      return false;
    }
    let valid = parsed.get(filterValue);
    if (valid === undefined) {
      valid = isFilterValue(filterValue);
      parsed.set(filterValue, valid);
    }
    return valid;
  };
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- TanStack's FilterFn contract passes the raw state value
  const filterFn = (row: FilterRowSource, columnId: string, filterValue: unknown): boolean =>
    isParsed(filterValue) ? matchesFilter(filterValue, row.getValue(columnId), options) : true;
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- TanStack's FilterFn contract passes the raw state value
  const autoRemove = (filterValue: unknown): boolean => !isParsed(filterValue);
  return Object.assign(filterFn, { autoRemove });
}
