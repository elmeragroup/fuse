"use client";

/**
 * The path form's columns as numbers the loop tweens, so a Bar above 100 slots moves on a data
 * update as its element form does, through the modes of `layout/path-motion.ts`. Each slot of the
 * window holds one entry, a column of no height where it has no reading, so a reading that appears
 * grows out of the zero line. An entry holds its column's middle and tip first, where the marks
 * attached to the series sit, then its span, its base, its missing tick's span and its emphasis
 * box's span. Its paint step, quality, projection and emphasis are topology, which the topology holds.
 * Above `DECIMATE_ABOVE` slots each M4 bucket is one entry, and each missing or emphasised slot one
 * more, which draws its tick or its box and no column, so decimation never drops an annotation.
 */
import { missingTickAt } from "./chart-bar-draw";
import type { SeriesPaint } from "./chart-bar-draw";
import type { ChartRootContextValue } from "./chart-context";
import type { MarkValues, ValueAxis } from "./chart-motion";
import { stepRole } from "./chart-paint";
import type { PathKind } from "./chart-path-draw";
import { bucketColumns, rectsPath } from "./layout/bar-geometry";
import type { SeriesModel } from "./layout/cartesian-model";
import { seriesPaint } from "./layout/color-key";
import { DECIMATE_ABOVE } from "./layout/decimate";
import type { PathSlots } from "./layout/path-motion";
import { barSpan, frameRect, slotBand, snapSpan, valueAt } from "./layout/plot-frame";
import type { BarMetrics, PlotFrame, PlotRect, SubBand } from "./layout/plot-frame";

/** The numbers of one column entry. */
export const COLUMN_STRIDE = 9;

/** What each of an entry's numbers measures, on the vertical frame the path form draws in. */
export const COLUMN_AXES: ValueAxis[] = ["x", "y", "x", "x", "y", "x", "x", "x", "x"];

/** A scale's seven steps. */
const STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

/** The share of a cell the path form leaves empty around its column, as the bars' band gap does. */
const PATH_GAP = 0.25;

/** One entry's topology. */
export type ColumnEntry = {
  /** The paint step it fills from, or -1 where it draws in no fill path. */
  readonly fill: number;
  readonly estimated: boolean;
  readonly projected: boolean;
  readonly missing: boolean;
  readonly emphasis: boolean;
  /**
   * Whether a route keeps the entry's old paint while its reading leaves, so it draws only while it
   * still has length, where a resting reading draws even below a device pixel.
   */
  readonly leaving: boolean;
};

/** The topology of a path form's entries. */
export type ColumnTopology = {
  readonly count: number;
  readonly entries: readonly ColumnEntry[];
};

/** The path form's entries over the effective window. */
export type ColumnsLayout = {
  readonly keys: readonly string[];
  /** Each entry's place in the window, in slots: a bucket's at its middle. */
  readonly positions: readonly number[];
  /** Every slot of the window. */
  readonly window: PathSlots;
  /** `COLUMN_STRIDE` numbers per entry, unsnapped CSS pixels. */
  readonly values: readonly number[];
  readonly topology: ColumnTopology;
  /** The paint of each fill step, "" for the series paint, in the order the topology names them. */
  readonly fills: readonly string[];
};

/** One entry as `layoutColumns` builds it: its key, its place in the window, numbers and topology. */
type Entry = {
  readonly key: string;
  readonly at: number;
  readonly numbers: readonly number[];
  readonly entry: ColumnEntry;
};

/** What one column of the path form draws. */
export type ColumnsDrawing = {
  /** One path's data per fill step. */
  readonly fills: readonly string[];
  readonly estimated: string;
  readonly projected: string;
  readonly missing: string;
  /** The emphasised entries' boxes, in entry order. */
  readonly emphasis: readonly PlotRect[];
};

/** What `layoutColumns` reads from Root: its model and the key each slot renders under. */
type ColumnsContext = Pick<ChartRootContextValue, "model" | "update">;

/** A slot's identity: its start instant or its name. */
function slotId(context: ColumnsContext, slot: number): string {
  const { domain } = context.model;
  return domain.kind === "time" ? String(domain.starts[slot] ?? slot) : (domain.names[slot] ?? String(slot));
}

/**
 * Lay out a path-form series' entries.
 *
 * @param context - Root's model, and the key each slot renders under.
 * @param series - The series.
 * @param frame - The vertical frame it draws in.
 * @param metrics - The bar spacing, which an emphasis box reads.
 * @param sub - The Bar's sub-band.
 * @param paint - The series' paint.
 * @param emphasised - The emphasised slots.
 * @returns The entries.
 */
export function layoutColumns(
  context: ColumnsContext,
  series: SeriesModel,
  frame: PlotFrame,
  metrics: BarMetrics,
  sub: SubBand,
  paint: SeriesPaint,
  emphasised: ReadonlySet<number>
): ColumnsLayout {
  const { model, update } = context;
  const window = model.window;
  if (window === null) {
    const empty = { keys: [], ids: [] };
    return {
      keys: [],
      positions: [],
      window: empty,
      values: [],
      topology: { count: 0, entries: [] },
      fills: [],
    };
  }
  const count = window.last - window.first + 1;
  const step = frame.box.width / Math.max(count, 1);
  const zero = valueAt(frame, 0);
  // A scale fills from one path per step, so an entry keeps its path index across updates, and a
  // role or a role list from one.
  const { bins } = paint;
  const fills =
    bins === undefined ? [""] : STEPS.map((step) => seriesPaint(paint.key, stepRole(paint.color, step)));
  const fillOf = (slot: number): number => {
    const reading = series.readings[slot];
    const extent = series.extents[slot];
    // A reading of 0 has no length, so it draws no column.
    if (extent === null || extent === undefined || extent[0] === extent[1]) return -1;
    if (reading?.kind !== "reading" || reading.quality === "estimated" || slot >= series.projectedFrom)
      return -1;
    return bins === undefined ? 0 : bins(reading.value) - 1;
  };
  const keyOf = (slot: number) => update.keys[slot] ?? slotId(context, slot);
  /** The entry of one slot's own column, its tick and its box. */
  const slotEntry = (slot: number): Entry => {
    const position = slot - window.first;
    const width = (1 - PATH_GAP) / sub.count;
    const x0 = (position + PATH_GAP / 2 + sub.index * width) * step;
    const x1 = x0 + width * step;
    const reading = series.readings[slot];
    const extent = series.extents[slot];
    const negative = extent !== null && extent !== undefined && extent[0] < 0 && extent[1] <= 0;
    // A reading of 0 has no length, so it draws in no path.
    const long = extent !== null && extent !== undefined && extent[0] !== extent[1];
    const [tip, base] =
      reading?.kind === "reading" && extent !== null && extent !== undefined
        ? [valueAt(frame, negative ? extent[0] : extent[1]), valueAt(frame, negative ? extent[1] : extent[0])]
        : [zero, zero];
    const [e0, e1] = barSpan(frame, position, metrics, sub);
    return {
      key: keyOf(slot),
      at: position,
      numbers: [(x0 + x1) / 2, tip, x0, x1, base, (position + 0.25) * step, (position + 0.75) * step, e0, e1],
      entry: {
        fill: fillOf(slot),
        estimated: long && reading?.kind === "reading" && reading.quality === "estimated",
        projected:
          long &&
          reading?.kind === "reading" &&
          reading.quality !== "estimated" &&
          slot >= series.projectedFrom,
        // The model reads no missing marker for an empty chart, as section 8.13 says.
        missing: reading?.kind === "missing" && !model.empty,
        emphasis: emphasised.has(slot),
        leaving: false,
      },
    };
  };
  const slots = Array.from({ length: count }, (_, index) => window.first + index);
  const whole = { keys: slots.map(keyOf), ids: slots.map((slot) => slotId(context, slot)) };
  let entries: Entry[];
  if (count <= DECIMATE_ABOVE) entries = slots.map(slotEntry);
  else {
    // A decimated window draws one column per M4 bucket and side of zero, keyed by the key of the
    // bucket's first slot, so a column keeps its data through a slide.
    const buckets = bucketColumns(model, series, frame.value.domain, sub).map((column): Entry => {
      const toY = (percent: number) => (percent / 100) * frame.box.height;
      const x0 = column.x0 * step;
      const x1 = column.x1 * step;
      const reading = series.readings[column.slot];
      return {
        key: `bucket ${keyOf(column.first)} ${column.side}`,
        at: (column.x0 + column.x1) / 2 - 0.5,
        numbers: [(x0 + x1) / 2, toY(column.top), x0, x1, toY(column.bottom), x0, x0, x0, x0],
        entry: {
          fill: fillOf(column.slot),
          estimated: reading?.kind === "reading" && reading.quality === "estimated",
          projected:
            column.slot >= series.projectedFrom &&
            !(reading?.kind === "reading" && reading.quality === "estimated"),
          missing: false,
          emphasis: false,
          leaving: false,
        },
      };
    });
    // Each missing or emphasised slot keeps its own tick or box, drawing no column of its own.
    const notes = slots.flatMap((slot): Entry[] => {
      const own = slotEntry(slot);
      if (!own.entry.missing && !own.entry.emphasis) return [];
      const entry = { ...own.entry, fill: -1, estimated: false, projected: false };
      return [{ ...own, key: `note ${own.key}`, entry }];
    });
    entries = [...buckets, ...notes].toSorted((a, b) => a.at - b.at);
  }
  return {
    keys: entries.map(({ key }) => key),
    positions: entries.map(({ at }) => at),
    window: whole,
    values: entries.flatMap(({ numbers }) => numbers),
    topology: { count: entries.length, entries: entries.map(({ entry }) => entry) },
    fills,
  };
}

/**
 * The topologies a path form draws from its entries' numbers, every edge on the device pixel grid. A
 * column of one slot keeps its pixel among the pixels of the slot its middle lies in, as a bar does.
 *
 * @param frame - The vertical frame.
 * @param topology - The entries' topology.
 * @param values - The entries' numbers, at rest or in a tween frame.
 * @returns What each path and emphasis box draws.
 */
export function columnsDrawing(
  frame: PlotFrame,
  topology: ColumnTopology,
  values: MarkValues
): ColumnsDrawing {
  const step = frame.box.width / frame.count;
  const fillCount = Math.max(0, ...topology.entries.map((entry) => entry.fill + 1));
  const fills: PlotRect[][] = Array.from({ length: fillCount }, () => []);
  const estimated: PlotRect[] = [];
  const projected: PlotRect[] = [];
  const emphasis: PlotRect[] = [];
  let missing = "";
  topology.entries.forEach((entry, index) => {
    const at = (offset: number) => values[index * COLUMN_STRIDE + offset] ?? 0;
    const position = Math.min(Math.max(Math.floor(at(0) / step), 0), frame.count - 1);
    const band = slotBand(frame, position);
    const rect = frameRect(frame, snapSpan(frame, at(2), at(3), band), [at(1), at(4)]);
    const drawn = !entry.leaving || rect.height > 0;
    if (entry.fill >= 0 && drawn) fills[entry.fill]?.push(rect);
    if (entry.estimated && drawn) estimated.push(rect);
    if (entry.projected && drawn) projected.push(rect);
    if (entry.missing) {
      const [from, to] = snapSpan(frame, at(5), at(6), band);
      missing += `M${String(from)} ${String(missingTickAt(frame, at(4)))}H${String(to)}`;
    }
    if (entry.emphasis) emphasis.push(frameRect(frame, snapSpan(frame, at(7), at(8), band), [at(1), at(4)]));
  });
  return {
    fills: fills.map((rects) => rectsPath(rects)),
    estimated: rectsPath(estimated),
    projected: rectsPath(projected),
    missing,
    emphasis,
  };
}

/**
 * The active overlay's bar geometry over one entry, from the entry's numbers in any frame: the
 * emphasis box's span, which is the element form's bar span, then the column's base and tip, no
 * seam and the overlay's top weight. A route's numbers move the span with the column as it slides.
 *
 * @param values - The entries' numbers, as a route or the rest lays them out.
 * @param index - The entry's index among them.
 * @param top - The overlay's top weight.
 * @returns The geometry, in `BarGeometry`'s order.
 */
export function columnOverlay(values: MarkValues, index: number, top: number): number[] {
  const at = (offset: number) => values[index * COLUMN_STRIDE + offset] ?? 0;
  return [at(7), at(8), at(4), at(1), 0, top];
}

/**
 * The path kind of the path form: a slide moves an entry's middle and every span. A decimated
 * window's tick or box that only one layout holds grows from or shrinks to the zero line in its own
 * place, and a bucket's column only one holds starts or ends on the other layout's columns.
 *
 * @param step - The distance from one slot to the next along the slot axis.
 * @param zero - Where the zero line lies across the value axis, unsnapped.
 * @returns The kind.
 */
export function columnKind(step: number, zero: number): PathKind<ColumnTopology, ColumnEntry> {
  const along = new Set([0, 2, 3, 5, 6, 7, 8]);
  return {
    stride: COLUMN_STRIDE,
    at: (topology, index) =>
      topology.entries[index] ?? {
        fill: -1,
        estimated: false,
        projected: false,
        missing: false,
        emphasis: false,
        leaving: false,
      },
    of: (entries) => ({ count: entries.length, entries }),
    // A column whose reading leaves keeps its old paint while it shrinks to the zero line, so it
    // never vanishes from the frame it last drew in, and draws in no path once it rests at 0.
    keep: (old, next) =>
      next.fill === -1 && !next.estimated && !next.projected
        ? { ...next, fill: old.fill, estimated: old.estimated, projected: old.projected, leaving: true }
        : next,
    shift: (vertex, by) => vertex.map((value, index) => (along.has(index) ? value + by * step : value)),
    // Only a decimated window's tick or box is an entry of one layout inside the window.
    flat: (vertex, entry) =>
      entry.fill === -1 && (entry.missing || entry.emphasis)
        ? vertex.map((value, index) => (index === 1 || index === 4 ? zero : value))
        : undefined,
  };
}
