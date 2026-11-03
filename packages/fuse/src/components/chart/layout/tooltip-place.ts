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
const BESIDE_OVERLAP = 0.5;

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

/** How far above the roof under it a popup rests, in CSS pixels. */
export const ROOF_GAP = 8;

/**
 * The drop a resting popup ignores, in CSS pixels. A step that would lower the popup by this much
 * or less keeps its height, so a scrub over small changes leaves it still.
 */
const SINK_SLACK = 16;

/** Where a popup sits over a plot: its left edge and its bottom edge, y down. */
export type PopupPlace = { readonly left: number; readonly bottom: number };

/** What a popup's resting place over the plot depends on, in plot pixels. */
export type RoofInput = {
  /** The active slot's centre along x. */
  readonly centre: number;
  /** The popup's width. */
  readonly width: number;
  /** The chart Root's left and right edges, which hold the popup. */
  readonly within: readonly [number, number];
  /**
   * The left and right edges the viewport leaves, `TOOLTIP_EDGE` inside its own. They hold the popup
   * after the Root's box does, so the popup rests where it shows.
   */
  readonly viewport: readonly [number, number];
  /** The roof over a span, or null where no mark reaches into it. */
  readonly roof: (start: number, end: number) => number | null;
  /** The roof where no mark reaches: the plot's bottom edge. */
  readonly floor: number;
  /** Where the popup rested before this step, or null when it opens. */
  readonly from: PopupPlace | null;
};

/**
 * Where a popup rests over a vertical plot. It centres on the active slot, held inside the chart
 * Root's box unless it is wider than the box, then inside the viewport's edges unless it is wider
 * than they leave, and rests `ROOF_GAP` above the roof under its own width at that place. A step that raises it raises it over the whole span it sweeps from its old place, so its
 * path clears the marks as well as its end. A step that would lower it by `SINK_SLACK` or less
 * keeps its old height.
 *
 * @param input - The slot, the popup, the box, the marks and the last resting place.
 * @returns The resting place.
 */
export function roofRest(input: RoofInput): PopupPlace {
  const { centre, width, within, viewport, roof, floor, from } = input;
  const left = heldIn(heldIn(centre - width / 2, width, within), width, viewport);
  const bottom = (roof(left, left + width) ?? floor) - ROOF_GAP;
  if (from === null) return { left, bottom };
  if (bottom < from.bottom) {
    const swept = roof(Math.min(from.left, left), Math.max(from.left, left) + width) ?? floor;
    return { left, bottom: Math.min(bottom, swept - ROOF_GAP) };
  }
  return { left, bottom: bottom - from.bottom <= SINK_SLACK ? from.bottom : bottom };
}

/** A left edge moved as little as it takes to keep a box of a width inside two edges, if it fits. */
function heldIn(left: number, width: number, [low, high]: readonly [number, number]): number {
  return width > high - low ? left : Math.min(Math.max(left, low), high - width);
}

/**
 * The path a popup glides along from one place to the next, as the places it turns at. It rises in
 * place to the height it travels at, crosses at that height, and then settles. It travels at the
 * higher of its two places, raised further to `ROOF_GAP` above the roof over the whole span it
 * sweeps, so no mark under that span reaches it, whatever the step's width. A straight line between
 * the two places can cut through a mark the new place clears, such as the new slot's own bar on a
 * chart whose bands are wider than the popup. There is no path, and the popup moves at once, when
 * the start already covers a mark, as a popup that grew wider at its old place can, or when the
 * travel height would carry the popup's top above `ceiling`.
 *
 * @param start - Where the popup shows as the glide starts.
 * @param end - Where it rests.
 * @param size - The popup's width and height.
 * @param roof - The roof over a span, or null where no mark reaches into it.
 * @param ceiling - The highest the popup's top may reach, the viewport's top edge gap.
 * @returns The places from `start` to `end`, each a turn of the path, with no repeats, or null when
 *   the start covers a mark or the path would leave the viewport.
 */
export function glidePath(
  start: PopupPlace,
  end: PopupPlace,
  size: PlaceSize,
  roof: (start: number, end: number) => number | null,
  ceiling: number
): PopupPlace[] | null {
  const { width, height } = size;
  const under = roof(start.left, start.left + width);
  if (under !== null && under < start.bottom) return null;
  const swept = roof(Math.min(start.left, end.left), Math.max(start.left, end.left) + width);
  const travel = Math.min(
    start.bottom,
    end.bottom,
    swept === null ? Number.POSITIVE_INFINITY : swept - ROOF_GAP
  );
  if (travel - height < ceiling) return null;
  const turns = [start, { left: start.left, bottom: travel }, { left: end.left, bottom: travel }, end];
  return turns.filter(
    (place, index) =>
      index === 0 || place.left !== turns[index - 1]?.left || place.bottom !== turns[index - 1]?.bottom
  );
}
