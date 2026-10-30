/**
 * Shared `Table.Cell` class string. `VerticalTable.Key` applies the
 * same layout and in-frame padding so a `render` host keeps the proven cell geometry.
 * Package-private — not on the `@elmeragroup/fuse/table` facade.
 *
 * A cell is a row: at least `--row-h` tall, padded with `--row-px` and `--row-py`, so a
 * one-line row measures exactly `--row-h` and a taller control grows the row by its own height.
 * `box-border` keeps the height a border-box one without preflight.
 */
import { cn } from "../../styles/cn";

/**
 * A cell's or head's inline padding. Each side reads a cell-local default, `--table-cell-ps` or
 * `--table-cell-pe`: `--row-px`, or 0 at the end of a cell holding a checkbox, or what a variant
 * such as the compact VerticalTable sets. The first and last of a row pad their outer side with the
 * Table's edge inset, `--table-edge-px`, instead, where a Frame or a padless panel sets one, so
 * their text lines up with its panels: their `--table-cell-edge-*` reads it, and stays invalid, so
 * the side falls back to its default, where nothing sets it. Each side is one `ps-*` or `pe-*`
 * utility, so a consumer's `ps-*`, `pe-*` or `px-*` class replaces it.
 */
export const TABLE_EDGE_PADDING_CLASSES = cn(
  "ps-[var(--table-cell-edge-ps,var(--table-cell-ps))] pe-[var(--table-cell-edge-pe,var(--table-cell-pe))] [--table-cell-pe:var(--row-px)] [--table-cell-ps:var(--row-px)] has-[[role=checkbox]]:[--table-cell-pe:0px]",
  "[--table-cell-edge-pe:initial] [--table-cell-edge-ps:initial] first:[--table-cell-edge-ps:var(--table-edge-px)] last:[--table-cell-edge-pe:var(--table-edge-px)]"
);

export const TABLE_CELL_CLASSES = cn(
  "box-border h-(--row-h) py-(--row-py) align-middle leading-none whitespace-nowrap",
  TABLE_EDGE_PADDING_CLASSES
);
