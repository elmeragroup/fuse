import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { TABLE_CELL_CLASSES } from "./table-cell-classes";

/**
 * A semantic `<td>`. It lives in its own module so `VerticalTable.Key` can default its `render` to
 * a `TableCell` without importing the server compound.
 */
export function TableCell({ className, ...props }: ComponentProps<"td">): ReactElement {
  return <td data-slot="table-cell" className={cn(TABLE_CELL_CLASSES, className)} {...props} />;
}

TableCell.displayName = "Table.Cell";
