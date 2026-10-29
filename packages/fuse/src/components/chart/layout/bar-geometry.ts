/**
 * Bar geometry in plot percentages, after CONTRACT sections 8.12 and 8.15. Along the category axis
 * a bar takes its slot's band, which `chart.css` narrows by `--chart-band-gap` and splits into
 * BarGroup sub-bands. Along the value axis `top` runs from the domain maximum and `height` from
 * there toward the minimum, so one pair serves both orientations.
 */
import type { CartesianModel, SeriesModel } from "./cartesian-model";
import { BUCKETS, DECIMATE_ABOVE, bucketEdges } from "./decimate";
import { linearScale, scaleValue } from "./linear-scale";
import type { Extent } from "./stack";
import { slotCount } from "./x-domain";

/** Above this many domain slots, with `period` included, a Bar draws one path per series. */
export const HTML_BAR_LIMIT = 100;

/** One drawn bar. */
export type BarCell = {
  readonly slot: number;
  /** The slot's place in the window, from 0. */
  readonly position: number;
  /** From the value maximum to the bar's far edge, in percent of the plot. */
  readonly top: number;
  /** The bar's length along the value axis, in percent of the plot. */
  readonly height: number;
  readonly negative: boolean;
  /** Whether the bar is its stack's outer segment on its side of zero, which takes the rounded end. */
  readonly stackTop: boolean;
};

/**
 * Which form a Bar draws in. The count covers the whole domain, so a brush never switches it.
 * Horizontal bars always take the HTML form, because each category gets a row of its own.
 *
 * @param model - The Root's model.
 * @param orientation - Root's orientation.
 * @returns "html" for 100 slots or fewer or for horizontal bars, else "path".
 */
export function barForm(model: CartesianModel, orientation: "vertical" | "horizontal"): "html" | "path" {
  if (orientation === "horizontal") return "html";
  return slotCount(model.domain) > HTML_BAR_LIMIT ? "path" : "html";
}

/** A Bar's sub-band inside a BarGroup: its place and the group's count of sub-bands. */
export type SubBand = { readonly index: number; readonly count: number };

/**
 * Whether an extent hangs below zero.
 *
 * @param extent - A drawn extent.
 * @returns Whether it lies at or below zero with a negative low end.
 */
export function isNegative(extent: readonly [number, number]): boolean {
  return extent[0] < 0 && extent[1] <= 0;
}

/**
 * Whether a key draws its stack's outer segment on its side of zero at a slot, the segment that
 * takes the rounded end. An unstacked key always does.
 *
 * @param model - The Root's model.
 * @param series - The key's series.
 * @param slot - A slot index.
 * @returns Whether the segment is outermost.
 */
export function isStackTop(model: CartesianModel, series: SeriesModel, slot: number): boolean {
  const extent = series.extents[slot];
  if (!extent) return false;
  if (series.stack === undefined) return true;
  const negative = isNegative(extent);
  const keys = new Set(model.stacks.find(({ id }) => id === series.stack)?.keys ?? []);
  return model.series.every((other) => {
    const span = other.extents[slot];
    if (other === series || !keys.has(other.key) || !span) return true;
    if (span[0] === span[1]) return true;
    return negative ? span[0] >= extent[0] || !isNegative(span) : span[1] <= extent[1] || isNegative(span);
  });
}

/**
 * The HTML form's bars of one series inside the window. A slot without a drawn extent, such as a
 * missing or pending reading, gets no bar.
 *
 * @param model - The Root's model.
 * @param series - The series.
 * @param y - The layout's value domain.
 * @returns One cell per drawn bar, in x order.
 */
export function barCells(
  model: CartesianModel,
  series: SeriesModel,
  y: readonly [number, number]
): BarCell[] {
  const window = model.window;
  if (window === null) return [];
  const scale = linearScale(y, [100, 0]);
  const cells: BarCell[] = [];
  for (let slot = window.first; slot <= window.last; slot += 1) {
    const extent = series.extents[slot];
    if (!extent) continue;
    const top = scaleValue(scale, extent[1]);
    cells.push({
      slot,
      position: slot - window.first,
      top,
      height: scaleValue(scale, extent[0]) - top,
      negative: isNegative(extent),
      stackTop: isStackTop(model, series, slot),
    });
  }
  return cells;
}

/** One column of the path form, in viewBox units: x in slots of the window, y in plot percent. */
export type PathColumn = {
  readonly x0: number;
  readonly x1: number;
  readonly top: number;
  readonly bottom: number;
  /** The slot whose reading the column draws, which picks its colour step and quality. */
  readonly slot: number;
};

/** The band gap's share of a slot in the path form, which draws in slot units. */
const PATH_GAP = 0.25;

/** The extent a stack column covers at a slot on one side of zero, from every segment of the stack. */
function sideTotal(model: CartesianModel, series: SeriesModel, slot: number, negative: boolean): number {
  const keys = new Set(model.stacks.find(({ id }) => id === series.stack)?.keys ?? [series.key]);
  let total = 0;
  for (const other of model.series) {
    const span = other.extents[slot];
    if (!keys.has(other.key) || !span) continue;
    total = negative ? Math.min(total, span[0]) : Math.max(total, span[1]);
  }
  return total;
}

/**
 * The path form's columns of one series. Up to 2,000 slots in the window each slot draws its own
 * column, narrowed by the band gap and split into the BarGroup's sub-bands as the HTML form is.
 * Above that the window splits into M4 buckets by slot index. A loose series draws each bucket's
 * column from its lowest negative extent to its highest positive extent, and the column takes the
 * slot of its larger extreme, so its colour step and quality are that reading's. A stacked series
 * draws the segment of the bucket's slot with the largest total magnitude on each side of zero.
 *
 * @param model - The Root's model.
 * @param series - The series.
 * @param y - The layout's value domain.
 * @param band - The Bar's sub-band, the whole band outside a BarGroup.
 * @returns The columns in x order.
 */
export function pathColumns(
  model: CartesianModel,
  series: SeriesModel,
  y: readonly [number, number],
  band: SubBand = { index: 0, count: 1 }
): PathColumn[] {
  const window = model.window;
  if (window === null) return [];
  const scale = linearScale(y, [100, 0]);
  const count = window.last - window.first + 1;
  const columns: PathColumn[] = [];
  const push = (from: number, to: number, extent: Extent | undefined, slot: number): void => {
    if (!extent || extent[0] === extent[1]) return;
    const width = (to - from) / band.count;
    const x0 = from + band.index * width;
    columns.push({
      x0,
      x1: x0 + width,
      top: scaleValue(scale, extent[1]),
      bottom: scaleValue(scale, extent[0]),
      slot,
    });
  };
  if (count <= DECIMATE_ABOVE) {
    for (let slot = window.first; slot <= window.last; slot += 1) {
      const position = slot - window.first;
      push(position + PATH_GAP / 2, position + 1 - PATH_GAP / 2, series.extents[slot], slot);
    }
    return columns;
  }
  const edges = bucketEdges(count);
  for (let bucket = 0; bucket < BUCKETS; bucket += 1) {
    const from = edges[bucket] ?? count;
    const to = edges[bucket + 1] ?? count;
    if (to <= from) continue;
    if (series.stack === undefined) {
      // The slots of the bucket's lowest and highest extents, and ties keep the first.
      let lowSlot = -1;
      let highSlot = -1;
      for (let index = from; index < to; index += 1) {
        const slot = window.first + index;
        const extent = series.extents[slot];
        if (!extent) continue;
        const lowest = series.extents[lowSlot];
        const highest = series.extents[highSlot];
        if (!lowest || extent[0] < lowest[0]) lowSlot = slot;
        if (!highest || extent[1] > highest[1]) highSlot = slot;
      }
      const lowest = series.extents[lowSlot];
      const highest = series.extents[highSlot];
      if (!lowest || !highest) continue;
      const low = Math.min(0, lowest[0]);
      const high = Math.max(0, highest[1]);
      // The larger extreme decides what the column stands for, and a tie keeps the positive one.
      push(from, to, [low, high], -low > high ? lowSlot : highSlot);
      continue;
    }
    for (const negative of [false, true]) {
      let best = -1;
      let magnitude = 0;
      for (let index = from; index < to; index += 1) {
        const slot = window.first + index;
        const total = Math.abs(sideTotal(model, series, slot, negative));
        if (total > magnitude) {
          magnitude = total;
          best = slot;
        }
      }
      const extent = best === -1 ? undefined : series.extents[best];
      if (extent && isNegative(extent) === negative) push(from, to, extent, best);
    }
  }
  return columns;
}

/**
 * One path's `d` from columns, as closed rectangles.
 *
 * @param columns - The columns.
 * @returns The path data, empty for no columns.
 */
export function columnsPath(columns: readonly PathColumn[]): string {
  return columns
    .map(
      ({ x0, x1, top, bottom }) =>
        `M${String(x0)} ${String(top)}H${String(x1)}V${String(bottom)}H${String(x0)}Z`
    )
    .join("");
}

/**
 * The entrance delay step of the bar at a position, after evilcharts' `getBarGrowAnimation`. The
 * step multiplies `--chart-stagger`.
 *
 * @param intro - Root's `data-intro`, "left" by default.
 * @param position - The bar's place in the window, from 0.
 * @param count - The window's slot count.
 * @returns The step, 0 for the first bar to grow.
 */
export function introStep(
  intro: "left" | "right" | "center" | "edges",
  position: number,
  count: number
): number {
  const last = count - 1;
  const centre = last / 2;
  switch (intro) {
    case "left":
      return position;
    case "right":
      return last - position;
    case "center":
      return Math.abs(position - centre);
    case "edges":
      return centre - Math.abs(position - centre);
  }
}
