// Source entry facade for `@elmeragroup/fuse/data-table`. Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. Subpath-only: it imports the optional `@tanstack/react-table` peer, so the
// root barrel leaves it out (OPTIONAL_PEER_ENTRIES in scripts/entries.ts). No public recipe.
export { DataTable } from "./components/data-table";
export { createFuseTableHook } from "./components/data-table/create-fuse-table-hook";
export type {
  CreateFuseTableHookOptions,
  CreateFuseTableHookResult,
  FuseCellComponents,
  FuseHeaderComponents,
  FuseTableComponents,
} from "./components/data-table/create-fuse-table-hook";
export { selectColumn } from "./components/data-table/select-column";
export type {
  SelectColumnDef,
  SelectColumnHelper,
  SelectColumnOptions,
} from "./components/data-table/select-column";
export type {
  DataTableBodyProps,
  DataTableContentProps,
  DataTableHeaderProps,
  DataTableRowProps,
} from "./components/data-table/data-table";
export type {
  DataTableCurrencyProps,
  DataTableDateProps,
  DataTableDateTimeProps,
  DataTableNumberProps,
  DataTableTextProps,
} from "./components/data-table/data-table-cells";
export type { DataTableColumnToggleProps } from "./components/data-table/data-table-column-toggle";
export type { DataTablePaginationProps } from "./components/data-table/data-table-pagination";
export type { PageStatus, PaginationTotal } from "./components/data-table/data-table-pagination-status";
export {
  CurrencyCell,
  DateCell,
  DateTimeCell,
  NumberCell,
  TextCell,
} from "./components/data-table/data-table-registered";
export type {
  CurrencyCellProps,
  DateCellProps,
  DateTimeCellProps,
  NumberCellProps,
  RegisteredColumnToggleProps,
  RegisteredContentProps,
  RegisteredPaginationProps,
  RegisteredRowProps,
  RegisteredSortButtonProps,
  TextCellProps,
} from "./components/data-table/data-table-registered";
export type {
  DataTableSelectAllProps,
  DataTableSelectRowProps,
} from "./components/data-table/data-table-selection";
export type { DataTableSortButtonProps } from "./components/data-table/data-table-sort-button";
