/**
 * Module-private DataTable recipe. The parts compose Table, Button, Select, Field, Checkbox and
 * DropdownMenu, which own their own control metrics; these slots only lay them out. Controls keep
 * the 24px target floor through their own sizes: the pagination, sort and row-actions buttons use
 * `icon-sm` and `sm`, and Checkbox inflates its hit area.
 */
import { tv } from "../../styles/tv";

export const dataTableVariants = tv({
  slots: {
    row: "",
    // The actions column shrinks to its trigger, as Table does for a checkbox column.
    head: "has-[[data-slot=data-table-actions-header]]:w-px",
    actionsCell: "flex justify-end",
    emptyCell: "h-24 text-center whitespace-normal text-muted-foreground",
    skeleton: "h-4 w-full max-w-32",
    sortButton: "-ms-2 gap-1.5",
    sortIcon: "text-muted-foreground",
    pagination: "text-sm flex flex-wrap items-center justify-end gap-x-6 gap-y-2",
    pageSize: "w-auto",
    pageStatus: "font-medium whitespace-nowrap tabular-nums",
    pageControls: "flex items-center gap-1",
    cellNumber: "tabular-nums",
  },
  variants: {
    pressable: {
      true: { row: "cursor-pointer" },
    },
  },
  defaultVariants: {
    pressable: false,
  },
});
