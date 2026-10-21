/**
 * The structural TanStack Table v9 slices the filter reads, picked from TanStack's exported
 * feature interfaces as `data-table-source.ts` does. A slice accepts the app's table whatever else
 * it registered, and rejects a table built without column filtering. Faceting is optional.
 */
import type {
  ColumnFiltersState,
  Column_ColumnFaceting,
  RowData,
  Table_ColumnFiltering,
  TableFeatures,
} from "@tanstack/react-table";

/** The column members the filter reads. Without faceting, lists show no counts. */
export type FilterColumnSource = { readonly id: string } & Partial<
  Pick<Column_ColumnFaceting<TableFeatures, RowData>, "getFacetedUniqueValues" | "getFacetedMinMaxValues">
>;

/** The `columnFilters` atom: its value and a subscription to its changes. */
export type ColumnFiltersAtomSource = {
  readonly get: () => ColumnFiltersState;
  readonly subscribe: (next: (value: ColumnFiltersState) => void) => { readonly unsubscribe: () => void };
};

/**
 * The table members `DataTableFilter.Root` reads: `setColumnFilters`, the `columnFilters` atom,
 * `getColumn` for faceting and `options.manualFiltering`, which selects server mode.
 */
export type FilterTableSource = Pick<Table_ColumnFiltering, "setColumnFilters"> & {
  readonly getColumn: (columnId: string) => FilterColumnSource | undefined;
  readonly options: { readonly manualFiltering?: boolean | undefined };
  readonly atoms: { readonly columnFilters: ColumnFiltersAtomSource };
};
