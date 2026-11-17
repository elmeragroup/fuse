import type { ReactNode } from "react";

import { RowActionsCell, RowActionsHeader } from "./data-table-row-actions";
import type { DisplayColumnHelper } from "./data-table-source";

/** The cell render context the actions column reads. */
type ActionsCellContext<TData> = { readonly row: { readonly original: TData } };

/**
 * The display column `actionsColumn` builds. It reads only the row's data, so it needs no table
 * feature.
 */
export type ActionsColumnDef<TData> = {
  readonly id: "actions";
  readonly enableSorting: false;
  readonly enableHiding: false;
  readonly enableResizing: false;
  readonly size: number;
  readonly header: () => ReactNode;
  readonly cell: (context: ActionsCellContext<TData>) => ReactNode;
};

/** `DisplayColumnHelper` for `actionsColumn`. */
export type ActionsColumnHelper<TData, TColumn> = DisplayColumnHelper<ActionsColumnDef<TData>, TColumn>;

/**
 * The actions column's width in px under `columnSizingFeature`. It fits the `icon-sm` trigger, 36px
 * at comfortable density, between a cell's start padding and a Frame's 25px edge inset.
 */
const ACTIONS_COLUMN_SIZE = 76;

/** Options for `actionsColumn`. */
export type ActionsColumnOptions<TData> = {
  /**
   * The row's own name, such as `(product) => product.name`. Fuse builds the trigger's localized
   * accessible name from it, such as "Actions for 4K Ultra HD Monitor", so no two triggers share a name.
   */
  getRowName: (row: TData) => string;
  /**
   * The menu items for a row: `DropdownMenu.Item`, including `variant="destructive"`, and
   * `DropdownMenu.Separator`.
   */
  items: (row: TData) => ReactNode;
};

/**
 * Builds the row-actions column, with `DataTable.RowActions` in each cell, right-aligned, and a
 * per-row accessible name. The header names the column "Actions" for assistive technology without
 * visible text, the column shrinks to the trigger, and the column turns off sorting and hiding. Clicks in
 * the open menu do not press a pressable row. In a table with `columnSizingFeature` the column is
 * 76px wide and cannot be resized.
 *
 * @template TData - The row data type, inferred from the column helper.
 * @template TColumn - The column definition type the helper returns.
 * @param columnHelper - A column helper for the table.
 * @param options - The row's name and its menu items.
 * @returns A display column with the id `"actions"`.
 */
export function actionsColumn<TData, TColumn>(
  columnHelper: ActionsColumnHelper<TData, TColumn>,
  { getRowName, items }: ActionsColumnOptions<NoInfer<TData>>
): TColumn {
  return columnHelper.display({
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    size: ACTIONS_COLUMN_SIZE,
    header: () => <RowActionsHeader />,
    cell: ({ row }) => <RowActionsCell name={getRowName(row.original)}>{items(row.original)}</RowActionsCell>,
  });
}
