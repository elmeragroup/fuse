/**
 * Shared `Table.Cell` class string. `VerticalTable.Key` applies the
 * same layout and in-frame padding so a `render` host keeps the proven cell geometry.
 * Package-private — not on the `@elmeragroup/fuse/table` facade.
 *
 * A cell is a row: at least `--row-h` tall, padded with `--row-px` and `--row-py`, so a
 * one-line row measures exactly `--row-h` and a taller control grows the row by its own height.
 * `box-border` keeps the height a border-box one without preflight.
 * In a framed Table, the first and last cells pad their outer side with the Frame's text inset,
 * so their text lines up with the Frame's header and panels. The body's own rule takes their 1px
 * edge border off it.
 */
import { cn } from "../../styles/cn";

export const TABLE_CELL_CLASSES = cn(
  "box-border h-(--row-h) px-(--row-px) py-(--row-py) align-middle leading-none whitespace-nowrap has-[[role=checkbox]]:pe-0 framed-table:first:ps-(--frame-text-inset) framed-table:last:pe-(--frame-text-inset)"
);
