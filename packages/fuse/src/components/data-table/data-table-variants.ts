/**
 * Module-private DataTable recipe. The parts compose Table, Button, Select, Field, Checkbox and
 * DropdownMenu, which own their own control metrics; these slots only lay them out. Controls keep
 * the 24px target floor through their own sizes: the pagination, sort and row-actions buttons use
 * `icon-sm` and `sm`, and Checkbox inflates its hit area.
 *
 * A table with `columnSizingFeature` lays out from its `<colgroup>` under `table-layout: fixed`,
 * so a cell clips content wider than its column with an ellipsis. Its width is 0, and a fixed
 * table is never narrower than its columns together, so it is exactly as wide as they are and a
 * column's width change moves no other column. Each `<col>` reads the width a resize drag
 * previews, `--_data-table-column-preview`, ahead of the one React renders,
 * `--_data-table-column`, so the drag never writes a value React owns. Header cells are the
 * positioning context for the resize handle. The handle floors its hit width at 24px, as `control-size.ts` floors the xs
 * control, so a host root under 16px keeps the target size. A sized header cell clips its content
 * with an ellipsis, and its end padding is at least the handle's footprint, so text and a sort
 * button stop before the handle. Its sort button sits 6px, not 8px, into the start padding,
 * which leaves the 2px focus ring inside the clip at the dense 8px padding.
 */
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

export const dataTableVariants = tv({
  slots: {
    row: "",
    // The actions column shrinks to its trigger, as Table does for a checkbox column.
    head: "has-[[data-slot=data-table-actions-header]]:w-px",
    actionsCell: "flex justify-end",
    emptyCell: "h-24 text-center whitespace-normal text-muted-foreground",
    skeleton: "h-4 w-full max-w-32",
    // The label truncates, so a sort button fits a column narrower than its label.
    sortButton: "-ms-2 max-w-full gap-1.5",
    sortLabel: "truncate",
    sortIcon: "text-muted-foreground",
    pagination: "text-sm flex flex-wrap items-center justify-end gap-x-6 gap-y-2",
    pageSize: "w-auto",
    pageStatus: "font-medium whitespace-nowrap tabular-nums",
    pageControls: "flex items-center gap-1",
    cellNumber: "tabular-nums",
    sizedTable: "w-0 table-fixed [&>tbody>tr>td]:overflow-hidden [&>tbody>tr>td]:text-ellipsis",
    sizedColumn: "w-[var(--_data-table-column-preview,var(--_data-table-column))]",
    resizeHandle: [
      "absolute inset-y-[2px] end-[2px] z-10 w-[max(--spacing(6),24px)] cursor-col-resize touch-none select-none",
      selfFocusRingClass,
      "after:absolute after:inset-y-1.5 after:end-0 after:w-px after:bg-border focus-visible:after:bg-primary data-resizing:after:bg-primary",
      "forced-colors:after:bg-[CanvasText] forced-colors:focus-visible:after:bg-[Highlight] forced-colors:data-resizing:after:bg-[Highlight]",
    ],
  },
  variants: {
    pressable: {
      true: { row: "cursor-pointer" },
    },
    sized: {
      true: {
        head: [
          "relative overflow-hidden text-ellipsis",
          "pe-[max(var(--table-cell-edge-pe,var(--table-cell-pe)),calc(max(--spacing(6),24px)+2px))]",
          "**:data-[slot=data-table-sort-button]:-ms-1.5",
        ],
      },
    },
  },
  defaultVariants: {
    pressable: false,
  },
});
