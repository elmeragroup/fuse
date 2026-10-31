/**
 * Bar geometry after CONTRACT sections 8.12 and 8.15. The model's extents become cells in value
 * space, and `plot-frame.ts` projects a cell into the measured plot. A stack's inner segment ends
 * `--chart-bar-seam` short of the next one at its far end, so the surface shows between segments.
 */
import type { BarVariant } from "./bar-shapes";
import type { CartesianModel, SeriesModel } from "./cartesian-model";
import { ownSlot, ownSpan } from "./coarse-slots";
import { BUCKETS, bucketEdges } from "./decimate";
import { linearScale, scaleValue } from "./linear-scale";
import { barSpan, frameRect, slotBand, snapSpan, valueAt } from "./plot-frame";
import type { BarMetrics, PlotFrame, PlotRect, SubBand } from "./plot-frame";
import type { Extent } from "./stack";
import { slotCount } from "./x-domain";

/** Above this many domain slots, with `period` included, a Bar draws one path per series. */
const BAR_LIMIT = 100;

/**
 * Which form a Bar draws in. The count covers the whole domain, so a brush never switches it.
 * Horizontal bars always draw one element per bar, because each category gets a row of its own.
 *
 * @param model - The Root's model.
 * @param orientation - Root's orientation.
 * @returns "bars" for 100 slots or fewer or for horizontal bars, else "path".
 */
export function barForm(model: CartesianModel, orientation: "vertical" | "horizontal"): "bars" | "path" {
  if (orientation === "horizontal") return "bars";
  return slotCount(model.domain) > BAR_LIMIT ? "path" : "bars";
}

/**
 * The look a series' bars draw in a form. The path form knows the "default" and "gradient" looks
 * only, so every other look draws the default one there.
 *
 * @param variant - The look the series' config names.
 * @param form - The form its bars draw in, from `barForm`.
 * @returns The drawn look.
 */
export function drawnBarVariant(variant: BarVariant, form: "bars" | "path"): BarVariant {
  if (form === "bars") return variant;
  return variant === "gradient" ? "gradient" : "default";
}

/** One drawn bar in value space. */
export type BarCell = {
  /** The bar's domain slot: the first Root slot of a coarse series' slot. */
  readonly slot: number;
  /** The slot's place in the window, from 0. */
  readonly position: number;
  /**
   * How many of the window's Root slots the bar's band covers: 1, or a coarse series' Root slots
   * inside the window, so an hourly bar on a quarter-hour grid spans its 4 cells.
   */
  readonly span: number;
  /** The low and high value the bar covers. */
  readonly extent: readonly [number, number];
  readonly negative: boolean;
  /** Whether the bar is its stack's outer segment on its side of zero, which takes the rounded end. */
  readonly stackTop: boolean;
};

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
 * One series' bar at a slot of the window, or null where it draws nothing, such as a missing or
 * pending reading or a slot outside the window. A coarse series' bar is the bar of its own slot
 * that holds the Root slot.
 *
 * @param model - The Root's model.
 * @param series - The series.
 * @param slot - A slot index.
 * @returns The cell, or null.
 */
export function barCellAt(model: CartesianModel, series: SeriesModel, slot: number): BarCell | null {
  const window = model.window;
  if (window === null || slot < window.first || slot > window.last) return null;
  const [first] = ownSlot(series, slot);
  const extent = series.extents[first];
  if (!extent) return null;
  return {
    slot: first,
    ...ownSpan(series, window, slot),
    extent,
    negative: isNegative(extent),
    stackTop: isStackTop(model, series, first),
  };
}

/**
 * The bars of one series inside the window, in x order, one per own slot.
 *
 * @param model - The Root's model.
 * @param series - The series.
 * @returns One cell per drawn bar.
 */
export function barCells(model: CartesianModel, series: SeriesModel): BarCell[] {
  const window = model.window;
  if (window === null) return [];
  const cells: BarCell[] = [];
  for (let slot = window.first; slot <= window.last; slot = ownSlot(series, slot)[1] + 1) {
    const cell = barCellAt(model, series, slot);
    if (cell !== null) cells.push(cell);
  }
  return cells;
}

/**
 * A bar's motion numbers, the one geometry the bar and every follower at its end draw from. The
 * loop tweens all six, and a tween frame's writer reads nothing else about the bar's shape:
 *
 * - its span along the slot axis;
 * - its signed base and tip across the value axis, where their values land, unsnapped, so a bar
 *   whose reading changes sign shrinks to its base and grows out on the other side, a stack's
 *   segment keeps its base on the tip of the one below, and a follower tweening `barTip` draws on
 *   the bar's drawn tip in every frame. Only the shapes a writer emits snap, so a reading shorter
 *   than a device pixel, whose base and tip snap to one pixel, keeps the side it lies on;
 * - its seam, how far short of its tip it stops, so a segment the update makes inner, or outer,
 *   opens or closes its seam with the motion rather than at the commit;
 * - its top weight, 1 for a stack's outer segment and a loose bar and 0 for an inner segment, which
 *   scales its rounded far end and its blocks track, so they grow and fade with the motion too.
 */
export type BarGeometry = readonly [
  alongStart: number,
  alongEnd: number,
  base: number,
  tip: number,
  seam: number,
  top: number,
];

/**
 * A cell's geometry in the plot at rest.
 *
 * @param frame - The layout's frame.
 * @param cell - The cell.
 * @param metrics - The bar spacing.
 * @param sub - The Bar's sub-band.
 * @param seam - "cut" ends a stack's inner segment a seam short at its far end, as drawn bars do,
 *   and "whole" keeps the full extent, as the active overlay does.
 * @returns The geometry, its span on the device pixel grid and its base and tip unsnapped.
 */
export function barGeometry(
  frame: PlotFrame,
  cell: BarCell,
  metrics: BarMetrics,
  sub: SubBand,
  seam: "cut" | "whole"
): BarGeometry {
  const [low, high] = cell.extent;
  // A bar keeps its pixel among its band's, so the crosshair band and the focused option cover it.
  const [start, stop] = barSpan(frame, cell.position, metrics, sub, cell.span);
  const band: readonly [number, number] = [
    slotBand(frame, cell.position)[0],
    slotBand(frame, cell.position + cell.span - 1)[1],
  ];
  const [alongStart, alongEnd] = snapSpan(frame, start, stop, band);
  return [
    alongStart,
    alongEnd,
    valueAt(frame, cell.negative ? high : low),
    barTip(frame, cell),
    seam === "cut" && !cell.stackTop ? metrics.seam : 0,
    cell.stackTop ? 1 : 0,
  ];
}

/**
 * The geometry a tween frame's numbers stand for.
 *
 * @param values - The loop's numbers for a bar.
 * @returns The geometry, with no seam and a full top weight where a number is missing.
 */
export function geometryOf(values: readonly number[]): BarGeometry {
  const [alongStart = 0, alongEnd = 0, base = 0, tip = 0, seam = 0, top = 1] = values;
  return [alongStart, alongEnd, base, tip, seam, top];
}

/**
 * Whether a bar's drawn tip lies on the negative side of its drawn base: below it on a vertical
 * frame and left of it on a horizontal one. It reads the unsnapped numbers, so a reading shorter
 * than a device pixel keeps its side, and a bar crossing zero turns its far end over the moment its
 * tip passes its base. A tip exactly on its base, a reading of 0, takes the positive side, as the
 * model never calls a reading of 0 negative and the resting bar carries no `data-negative`.
 *
 * @param frame - The layout's frame.
 * @param geometry - The drawn geometry.
 * @returns Whether the bar hangs below its base.
 */
export function hangs(frame: PlotFrame, [, , base, tip]: BarGeometry): boolean {
  return frame.orientation === "vertical" ? tip > base : tip < base;
}

/**
 * The rectangle a bar's drawn geometry stands for, every edge on the device pixel grid. A stack's
 * inner segment ends its seam short of its tip, so the surface shows between segments.
 *
 * @param frame - The layout's frame.
 * @param geometry - The drawn geometry, a tween frame's or the target's.
 * @returns The rectangle.
 */
export function geometryRect(frame: PlotFrame, geometry: BarGeometry): PlotRect {
  const [alongStart, alongEnd, base, tip, seam] = geometry;
  const end = tip + Math.sign(base - tip) * Math.min(Math.max(0, seam), Math.abs(tip - base));
  return frameRect(frame, [alongStart, alongEnd], [base, end]);
}

/**
 * A cell's rectangle in the plot at rest, every edge on the device pixel grid.
 *
 * @param frame - The layout's frame.
 * @param cell - The cell.
 * @param metrics - The bar spacing.
 * @param sub - The Bar's sub-band.
 * @param seam - "cut" or "whole", as `barGeometry` reads it.
 * @returns The rectangle.
 */
export function barRect(
  frame: PlotFrame,
  cell: BarCell,
  metrics: BarMetrics,
  sub: SubBand,
  seam: "cut" | "whole"
): PlotRect {
  return geometryRect(frame, barGeometry(frame, cell, metrics, sub, seam));
}

/**
 * The value a cell's own end stands for: the tip of a positive bar and the low end of a negative
 * one, where a value label and the active value line belong.
 *
 * @param cell - The cell.
 * @returns The value.
 */
export function barEndValue(cell: BarCell): number {
  return cell.negative ? cell.extent[0] : cell.extent[1];
}

/**
 * Where a cell's own value lands, unsnapped: the number a bar's tip and every follower at it tween,
 * each writer snapping what it draws, so they meet on the same device pixel in every frame.
 *
 * @param frame - The layout's frame.
 * @param cell - The cell.
 * @returns CSS pixels from the plot's top or left edge.
 */
export function barTip(frame: PlotFrame, cell: BarCell): number {
  return valueAt(frame, barEndValue(cell));
}

/**
 * One decimated column of the path form, in viewBox units: x in slots of the window, y in plot
 * percent.
 */
export type BucketColumn = {
  readonly x0: number;
  readonly x1: number;
  readonly top: number;
  readonly bottom: number;
  /** The slot whose reading the column draws, which picks its colour step and quality. */
  readonly slot: number;
  /**
   * The domain slot the column's bucket starts at, whose key names the column across updates, so a
   * slide that moves whole buckets keeps each column with the data it draws.
   */
  readonly first: number;
  /**
   * Which of the bucket's columns it is: a loose series' one column across zero, or a stacked
   * series' segment above or below it, so a bucket keeps each column's identity across updates.
   */
  readonly side: "across" | "above" | "below";
};

/** Each stack's reach on either side of zero at every slot. */
type StackSides = { readonly positive: Float64Array; readonly negative: Float64Array };

/** The stack sides by model and stack, which every member's columns read. */
const stackSides = new WeakMap<CartesianModel, Map<string, StackSides>>();

/**
 * The extent a stack column covers at every slot on each side of zero, from every segment of the
 * stack, computed once per model and stack.
 */
function sidesOf(model: CartesianModel, series: SeriesModel): StackSides {
  const byStack = stackSides.get(model) ?? new Map<string, StackSides>();
  stackSides.set(model, byStack);
  const id = series.stack ?? `key ${series.key}`;
  const cached = byStack.get(id);
  if (cached !== undefined) return cached;
  const keys = new Set(model.stacks.find((stack) => stack.id === series.stack)?.keys ?? [series.key]);
  const members = model.series.filter(({ key }) => keys.has(key));
  const count = Math.max(0, ...members.map(({ extents }) => extents.length));
  const positive = new Float64Array(count);
  const negative = new Float64Array(count);
  for (const member of members) {
    member.extents.forEach((span, slot) => {
      if (!span) return;
      negative[slot] = Math.min(negative[slot] ?? 0, span[0]);
      positive[slot] = Math.max(positive[slot] ?? 0, span[1]);
    });
  }
  const sides = { positive, negative };
  byStack.set(id, sides);
  return sides;
}

/**
 * The path form's decimated columns of one series, which `layoutColumns` draws above
 * `DECIMATE_ABOVE` slots, where every slot up to it draws its own entry. The window splits into M4
 * buckets by slot index, each split into the BarGroup's sub-bands. A loose series draws each bucket's
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
export function bucketColumns(
  model: CartesianModel,
  series: SeriesModel,
  y: readonly [number, number],
  band: SubBand = { index: 0, count: 1 }
): BucketColumn[] {
  const window = model.window;
  if (window === null) return [];
  const scale = linearScale(y, [100, 0]);
  const count = window.last - window.first + 1;
  const columns: BucketColumn[] = [];
  const push = (
    from: number,
    to: number,
    extent: Extent | undefined,
    slot: number,
    at: { readonly first: number; readonly side: BucketColumn["side"] }
  ): void => {
    if (!extent || extent[0] === extent[1]) return;
    const width = (to - from) / band.count;
    const x0 = from + band.index * width;
    columns.push({
      x0,
      x1: x0 + width,
      top: scaleValue(scale, extent[1]),
      bottom: scaleValue(scale, extent[0]),
      slot,
      ...at,
    });
  };
  const edges = bucketEdges(count);
  const sides = series.stack === undefined ? null : sidesOf(model, series);
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
      push(from, to, [low, high], -low > high ? lowSlot : highSlot, {
        first: window.first + from,
        side: "across",
      });
      continue;
    }
    for (const negative of [false, true]) {
      const reach = (negative ? sides?.negative : sides?.positive) ?? [];
      let best = -1;
      let magnitude = 0;
      for (let index = from; index < to; index += 1) {
        const slot = window.first + index;
        const total = Math.abs(reach[slot] ?? 0);
        if (total > magnitude) {
          magnitude = total;
          best = slot;
        }
      }
      const extent = best === -1 ? undefined : series.extents[best];
      if (extent && isNegative(extent) === negative)
        push(from, to, extent, best, { first: window.first + from, side: negative ? "below" : "above" });
    }
  }
  return columns;
}

/**
 * One path's `d` from rectangles, each a closed subpath.
 *
 * @param rects - The rectangles.
 * @returns The path data, empty for none.
 */
export function rectsPath(rects: readonly PlotRect[]): string {
  return rects
    .map(
      ({ x, y, width, height }) =>
        `M${String(x)} ${String(y)}H${String(x + width)}V${String(y + height)}H${String(x)}Z`
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
