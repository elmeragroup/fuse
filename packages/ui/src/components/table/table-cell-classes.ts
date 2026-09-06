/**
 * Shared `Table.Cell` class string. `VerticalTable.Key` applies the
 * same layout and in-frame padding so a `render` host keeps the proven cell geometry.
 * Package-private — not on the `@elmeragroup/ui/table` facade.
 */
import { cn } from "../../styles/cn";

export const TABLE_CELL_CLASSES = cn(
  "p-2 align-middle leading-none whitespace-nowrap in-data-[slot=frame]:first:p-[calc(--spacing(2.5)-1px)] in-data-[slot=frame]:last:p-[calc(--spacing(2.5)-1px)] has-[[role=checkbox]]:pe-0"
);
