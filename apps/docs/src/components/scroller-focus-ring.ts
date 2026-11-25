import { cn } from "tailwind-variants";

/**
 * The focus ring of a docs scroller that is a tab stop: a code block, a docs table's wrap and the
 * palette inspector's table. The ring is drawn inside the border, so an ancestor that clips its
 * overflow, such as a demo frame or a sheet, cannot cut it off.
 */
export const SCROLLER_FOCUS_RING = cn(
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
);
