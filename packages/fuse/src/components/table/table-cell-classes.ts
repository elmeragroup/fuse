/**
 * Shared `Table.Cell` class string. `VerticalTable.Key` applies the
 * same layout and in-frame padding so a `render` host keeps the proven cell geometry.
 * Package-private — not on the `@elmeragroup/fuse/table` facade.
 *
 * A cell is a row: at least `--row-h` tall, padded with `--row-px` and `--row-py`, so a
 * one-line row measures exactly `--row-h` and a taller control grows the row by its own height.
 * `box-border` keeps the height a border-box one without preflight.
 * Inside a Frame, the first and last cells sit 2px further in, less their 1px edge border.
 */
import { cn } from "../../styles/cn";

export const TABLE_CELL_CLASSES = cn(
  "box-border h-(--row-h) px-(--row-px) py-(--row-py) align-middle leading-none whitespace-nowrap in-data-[slot=frame]:first:px-[calc(var(--row-px)+--spacing(0.5)-1px)] in-data-[slot=frame]:last:px-[calc(var(--row-px)+--spacing(0.5)-1px)] has-[[role=checkbox]]:pe-0"
);
