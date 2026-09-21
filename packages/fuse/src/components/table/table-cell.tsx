import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { TABLE_CELL_CLASSES } from "./table-cell-classes";

/**
 * Semantic `<td>`. Package-private implementation for `Table.Cell` so
 * `VerticalTable.Key` can default `render ?? <TableCell />` without importing the
 * server compound.
 */
export function TableCell({ className, ...props }: ComponentProps<"td">): ReactElement {
  return <td data-slot="table-cell" className={cn(TABLE_CELL_CLASSES, className)} {...props} />;
}

TableCell.displayName = "Table.Cell";
