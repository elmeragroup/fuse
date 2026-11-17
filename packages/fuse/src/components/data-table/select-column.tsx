import type { ReactNode } from "react";

import { DataTableSelectAll, DataTableSelectRow } from "./data-table-selection";
import type { DisplayColumnHelper, SelectAllSource, SelectRowSource } from "./data-table-source";

/** The header render context the selection column reads. */
type SelectHeaderContext = { readonly table: SelectAllSource };

/** The cell render context the selection column reads. */
type SelectCellContext<TData> = { readonly row: SelectRowSource & { readonly original: TData } };

/**
 * The display column `selectColumn` builds. Its header and cell read only the selection members,
 * so a column helper whose table lacks `rowSelectionFeature` does not accept it.
 */
export type SelectColumnDef<TData> = {
  readonly id: "select";
  readonly enableSorting: false;
  readonly enableHiding: false;
  readonly enableResizing: false;
  readonly size: number;
  readonly header: (context: SelectHeaderContext) => ReactNode;
  readonly cell: (context: SelectCellContext<TData>) => ReactNode;
};

/** `DisplayColumnHelper` for `selectColumn`. */
export type SelectColumnHelper<TData, TColumn> = DisplayColumnHelper<SelectColumnDef<TData>, TColumn>;

/**
 * The selection column's width in px under `columnSizingFeature`. It fits the checkbox after the
 * widest start padding a cell takes, a Frame's 25px edge inset at comfortable density.
 */
const SELECT_COLUMN_SIZE = 48;

/** Options for `selectColumn`. */
export type SelectColumnOptions<TData> = {
  /**
   * The accessible name of a row's checkbox, distinct per row, such as
   * `` (order) => `Select order ${order.id}` ``. Required, so no two checkboxes share a name.
   */
  getRowLabel: (row: TData) => string;
};

/**
 * Builds the selection column, with `DataTable.SelectAll` in the header and `DataTable.SelectRow` in
 * each cell, and sorting and hiding turned off. "Select all" covers only the current page. In a
 * table with `columnSizingFeature` the column is 48px wide and cannot be resized.
 *
 * @template TData - The row data type, inferred from the column helper.
 * @template TColumn - The column definition type the helper returns.
 * @param columnHelper - A column helper whose table registers `rowSelectionFeature`.
 * @param options - The per-row checkbox label.
 * @returns A display column with the id `"select"`.
 */
export function selectColumn<TData, TColumn>(
  columnHelper: SelectColumnHelper<TData, TColumn>,
  { getRowLabel }: SelectColumnOptions<NoInfer<TData>>
): TColumn {
  return columnHelper.display({
    id: "select",
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    size: SELECT_COLUMN_SIZE,
    header: ({ table }) => <DataTableSelectAll table={table} />,
    cell: ({ row }) => <DataTableSelectRow row={row} label={getRowLabel(row.original)} />,
  });
}
