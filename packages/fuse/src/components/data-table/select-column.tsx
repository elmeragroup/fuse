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
  readonly header: (context: SelectHeaderContext) => ReactNode;
  readonly cell: (context: SelectCellContext<TData>) => ReactNode;
};

/** `DisplayColumnHelper` for `selectColumn`. */
export type SelectColumnHelper<TData, TColumn> = DisplayColumnHelper<SelectColumnDef<TData>, TColumn>;

/** Options for `selectColumn`. */
export type SelectColumnOptions<TData> = {
  /**
   * The accessible name of a row's checkbox, distinct per row, such as
   * `` (order) => `Select order ${order.id}` ``. Required, so no two checkboxes share a name.
   */
  getRowLabel: (row: TData) => string;
};

/**
 * Build the selection column: `DataTable.SelectAll` in the header and `DataTable.SelectRow` in each
 * cell, with sorting and hiding disabled. "Select all" is scoped to the current page.
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
    header: ({ table }) => <DataTableSelectAll table={table} />,
    cell: ({ row }) => <DataTableSelectRow row={row} label={getRowLabel(row.original)} />,
  });
}
