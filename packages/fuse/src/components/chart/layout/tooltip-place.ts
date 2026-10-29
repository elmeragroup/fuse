/** A box in client coordinates. */
export type PlaceBox = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

/** A width and a height in CSS pixels. */
export type PlaceSize = { readonly width: number; readonly height: number };

/**
 * The viewport inset of every side test, CONTRACT section 9.5's 8 px. A side holds the popup only
 * when the popup stays this far inside the viewport there.
 */
export const TOOLTIP_EDGE = 8;

/**
 * How far a popup beside the column reaches over the column's edge. The positioner rounds the
 * popup's place to whole device pixels, which can leave a strip up to half a pixel wide between
 * the popup and its column. That strip belongs to the neighbouring slot, so a pointer that
 * crossed to the popup through it would change the slot it reads. Vertical placements need no
 * overlap, since a pointer that crosses to them stays on the column's own slot.
 */
export const BESIDE_OVERLAP = 0.5;

/**
 * Whether some side of the column holds the popup inside the viewport: above, below, or beside it.
 *
 * @param column - The active column's box.
 * @param popup - The popup's size, held to the viewport's height.
 * @param viewport - The viewport's size.
 * @returns True when the popup fits above, below or beside the column.
 */
export function someSideHolds(column: PlaceBox, popup: PlaceSize, viewport: PlaceSize): boolean {
  return (
    column.top - popup.height >= TOOLTIP_EDGE ||
    column.bottom + popup.height <= viewport.height - TOOLTIP_EDGE ||
    column.right + popup.width <= viewport.width - TOOLTIP_EDGE ||
    column.left - popup.width >= TOOLTIP_EDGE
  );
}

/**
 * The offset that keeps the popup on its column's edge, or that moves it over the plot when no side
 * of the column holds it. Then a popup above the column moves down until its top meets the
 * viewport's edge gap, and one below moves up until its bottom does, so all of its content stays
 * inside the viewport. A popup beside the column reaches over its edge by {@link BESIDE_OVERLAP}.
 *
 * @param side - The side the positioner tries.
 * @param column - The active column's box.
 * @param popup - The popup's size, held to the viewport's height.
 * @param viewport - The viewport's size.
 * @returns The side offset in CSS pixels, negative when the popup reaches over the column.
 */
export function tooltipSideOffset(
  side: string,
  column: PlaceBox,
  popup: PlaceSize,
  viewport: PlaceSize
): number {
  if (side !== "top" && side !== "bottom") return -BESIDE_OVERLAP;
  if (someSideHolds(column, popup, viewport)) return 0;
  if (side === "top") return column.top - popup.height - TOOLTIP_EDGE;
  return viewport.height - TOOLTIP_EDGE - popup.height - column.bottom;
}
