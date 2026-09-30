import type { ReactNode } from "react";

import { RowActionsCell, RowActionsHeader } from "./data-table-row-actions";

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
  readonly header: () => ReactNode;
  readonly cell: (context: ActionsCellContext<TData>) => ReactNode;
};

/** The `display` member of a TanStack column helper, from `createColumnHelper` or a table hook. */
export type ActionsColumnHelper<TData, TColumn> = {
  readonly display: (column: ActionsColumnDef<TData>) => TColumn;
};

/** Options for `actionsColumn`. */
export type ActionsColumnOptions<TData> = {
  /**
   * The row's own name, such as `(product) => product.name`. Fuse builds the trigger's localized
   * accessible name from it ("Actions for 4K Ultra HD Monitor"), so no two triggers share a name.
   */
  getRowName: (row: TData) => string;
  /**
   * The menu items for a row: `DropdownMenu.Item`, including `variant="destructive"`, and
   * `DropdownMenu.Separator`.
   */
  items: (row: TData) => ReactNode;
};

/**
 * Build the row-actions column: `DataTable.RowActions` in each cell, right-aligned, with a
 * per-row accessible name. The header names the column "Actions" for assistive technology without
 * visible text, the column shrinks to the trigger, and sorting and hiding are disabled. Clicks in
 * the open menu do not press a pressable row.
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
    header: () => <RowActionsHeader />,
    cell: ({ row }) => <RowActionsCell name={getRowName(row.original)}>{items(row.original)}</RowActionsCell>,
  });
}
