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
import type { ChartRootContextValue } from "./chart-context";
import type { MarkValues, ValueAxis } from "./chart-motion";
import { readingPaint } from "./chart-paint";
import type { SeriesPaint } from "./chart-paint";
import type { PathKind } from "./chart-path-draw";
import {
  apartEnds,
  bucketColumns,
  floorPlaces,
  isNegative,
  projectedEnds,
  rectsPath,
} from "./layout/bar-geometry";
import type { SeriesModel } from "./layout/cartesian-model";
import { ownSpan, ownWindowFirsts } from "./layout/coarse-slots";
import { DECIMATE_ABOVE } from "./layout/decimate";
import type { PathSlots } from "./layout/path-motion";
import {
  barSpan,
  floorBody,
  frameRect,
  slotAxisAt,
  slotBandAt,
  snapBarSpan,
  snapSpan,
  valueAt,
} from "./layout/plot-frame";
import type { BarMetrics, PlotFrame, PlotRect, StackPlace, SubBand } from "./layout/plot-frame";
import { windowSlots } from "./layout/series-path";
import { slotId } from "./layout/slot-keys";

/** The numbers of one column entry. */
export const COLUMN_STRIDE = 9;

/** What each of an entry's numbers measures, on the vertical frame the path form draws in. */
export const COLUMN_AXES: ValueAxis[] = ["x", "y", "x", "x", "y", "x", "x", "x", "x"];

/**
 * Which of its step's paths a column draws in: the solid fill, the estimated outline or the
 * projected fill. It is the paths' `data-part`.
 */
export type ColumnPart = "fill" | "estimated" | "projected";

/** One entry's topology. */
export type ColumnEntry = {
  /**
   * Which of the entry's numbers is its column's base: the fifth, its own base, for a slot's
   * column and a decimated column above zero, and the second, its upper end, for a decimated
   * column below zero, whose upper end lies toward zero. The other number is the far end, where
   * the pixel floor grows. The bucket's own reading decides it in value space, so a projection's
   * float error never turns a column over.
   */
  readonly baseAt: 1 | 4;
  /**
   * The paint step its column draws in, whatever its quality, or -1 where it draws no column.
   * `part` picks the step's solid, estimated or projected path.
   */
  readonly fill: number;
  readonly part: ColumnPart;
  readonly missing: boolean;
  readonly emphasis: boolean;
  /**
   * Whether a route keeps the entry's old paint while its reading leaves, so it draws only while it
   * still has length, where a resting reading draws even below a device pixel.
   */
  readonly leaving: boolean;
  /**
   * Whether its column owns its stack side's pixel floor at rest, from `floorPlaces`, which the first
   * draw takes before the stack floors decide it in each frame. A loose column always owns it.
   */
  readonly place: StackPlace;
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
  /**
   * `COLUMN_STRIDE` numbers per entry in CSS pixels, unsnapped but for a slot's column span, which
   * its emphasis box shares.
   */
  readonly values: readonly number[];
  readonly topology: ColumnTopology;
  /** The paint of each fill step, "" for the series paint, in the order the topology names them. */
  readonly fills: readonly string[];
  /**
   * Each emphasised entry's key and own paint, in entry order: its value's scale or threshold step,
   * or undefined for the series paint.
   */
  readonly emphasis: readonly { readonly key: string; readonly paint: string | undefined }[];
};

/**
 * One entry as `layoutColumns` builds it: its key, its place in the window, numbers and topology,
 * and an emphasised slot's own paint.
 */
type Entry = {
  readonly key: string;
  readonly at: number;
  readonly numbers: readonly number[];
  readonly entry: ColumnEntry;
  readonly paint?: string | undefined;
};

/** What one column of the path form draws. */
export type ColumnsDrawing = {
  /** One solid path's data per fill step. */
  readonly fill: readonly string[];
  /** One estimated path's data per fill step. */
  readonly estimated: readonly string[];
  /** One projected path's data per fill step. */
  readonly projected: readonly string[];
  readonly missing: string;
  /** The emphasised entries' boxes, in entry order. */
  readonly emphasis: readonly PlotRect[];
};

/** What `layoutColumns` reads from Root: its model and the key each slot renders under. */
type ColumnsContext = Pick<ChartRootContextValue, "model" | "update">;

/**
 * Lay out a path-form series' entries.
 *
 * @param context - Root's model, and the key each slot renders under.
 * @param series - The series.
 * @param frame - The vertical frame it draws in.
 * @param metrics - The bar spacing, which every column and its emphasis box read.
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
      emphasis: [],
    };
  }
  const count = window.last - window.first + 1;
  const step = frame.box.width / Math.max(count, 1);
  const zero = valueAt(frame, 0);
  // A scale or a threshold fills from one path per step, so an entry keeps its path index across
  // updates, and a role or a role list from one. Each step has its own estimated and projected
  // paths too, so a reading's colour never depends on its quality.
  const { bins, ramp } = paint;
  const fills = bins === undefined || ramp === undefined ? [""] : ramp;
  /** A slot's column: its paint step and the path of its quality, or step -1 where it draws none. */
  const columnOf = (slot: number): Pick<ColumnEntry, "fill" | "part"> => {
    const reading = series.readings[slot];
    const extent = series.extents[slot];
    // A reading of 0 has no length, so it draws no column.
    if (extent === null || extent === undefined || extent[0] === extent[1] || reading?.kind !== "reading")
      return { fill: -1, part: "fill" };
    return {
      fill: bins === undefined ? 0 : bins(reading.value) - 1,
      part:
        reading.quality === "estimated" ? "estimated" : slot >= series.projectedFrom ? "projected" : "fill",
    };
  };
  const keyOf = (slot: number) => update.keys[slot] ?? slotId(model.domain, slot);
  const placeAt = floorPlaces(model, series);
  /** The entry of one own slot's column, its tick and its box, across every Root slot it covers. */
  const slotEntry = (slot: number): Entry => {
    const { position, span } = ownSpan(series, window, slot);
    // The column, its emphasis box and the active overlay over it draw the element form's bar span.
    const [x0, x1] = barSpan(frame, position, metrics, sub, span);
    // The missing tick spans the middle half of the slot's run along the grid, unsnapped, so slots
    // narrower than a device pixel keep it inside their own.
    const tickAt = (share: number) => slotAxisAt(frame, (position + share * span) / frame.count);
    const reading = series.readings[slot];
    const extent = series.extents[slot];
    const negative = extent !== null && extent !== undefined && extent[0] < 0 && extent[1] <= 0;
    const emphasis = emphasised.has(slot);
    const [base, tip] =
      reading?.kind === "reading" && extent !== null && extent !== undefined
        ? projectedEnds(frame, extent, negative)
        : [zero, zero];
    return {
      key: keyOf(slot),
      at: position,
      numbers: [(x0 + x1) / 2, tip, x0, x1, base, tickAt(0.25), tickAt(0.75), x0, x1],
      entry: {
        ...columnOf(slot),
        baseAt: 4,
        // The model reads no missing marker for an empty chart, as section 8.13 says.
        missing: reading?.kind === "missing" && !model.empty,
        emphasis,
        leaving: false,
        place: placeAt(slot),
      },
      // The emphasis box paints the step of its slot's value, as the column under it does.
      paint: emphasis ? readingPaint(paint, reading) : undefined,
    };
  };
  const slots = Array.from({ length: count }, (_, index) => window.first + index);
  const whole = windowSlots(model, update.keys);
  let entries: Entry[];
  if (count <= DECIMATE_ABOVE) entries = ownWindowFirsts(series, window).map(slotEntry);
  else {
    // A decimated window draws one column per M4 bucket and side of zero, keyed by the key of the
    // bucket's first slot, so a column keeps its data through a slide.
    const buckets = bucketColumns(model, series, frame.value.domain, sub).map((column): Entry => {
      const toY = (percent: number) => (percent / 100) * frame.box.height;
      const x0 = column.x0 * step;
      const x1 = column.x1 * step;
      const own = series.extents[column.slot];
      // The side of zero the column's own reading lies on, in value space.
      const side = own && isNegative(own) ? "negative" : "positive";
      const [top, bottom] = apartEnds(toY(column.top), toY(column.bottom), side);
      // A column keeps its upper end in the tip's place and its lower end in the base's, whichever
      // side of zero it stands for, so a tween between two columns of a bucket moves each end to
      // its own new place, and `baseAt` names its base.
      return {
        key: `bucket ${keyOf(column.first)} ${column.side}`,
        at: (column.x0 + column.x1) / 2 - 0.5,
        numbers: [(x0 + x1) / 2, top, x0, x1, bottom, x0, x0, x0, x0],
        entry: {
          ...columnOf(column.slot),
          baseAt: side === "negative" ? 1 : 4,
          missing: false,
          emphasis: false,
          leaving: false,
          place: placeAt(column.slot),
        },
      };
    });
    // Each missing or emphasised slot keeps its own tick or box, drawing no column of its own.
    const notes = slots
      .filter((slot) => (series.readings[slot]?.kind === "missing" && !model.empty) || emphasised.has(slot))
      .map((slot): Entry => {
        const own = slotEntry(slot);
        const entry: ColumnEntry = { ...own.entry, fill: -1, part: "fill" };
        return { ...own, key: `note ${own.key}`, entry };
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
    emphasis: entries.flatMap(({ key, entry, paint: own }) => (entry.emphasis ? [{ key, paint: own }] : [])),
  };
}

/**
 * The topologies a path form draws from its entries' numbers, every edge on the device pixel grid. A
 * column of one slot keeps its pixel among the pixels of the slot its middle lies in, as a bar does.
 * Every slot's column, tick and emphasis box snaps through `snapBarSpan`, so a column at rest,
 * which `barSpan` laid on the grid, draws as it is, and a tween frame's column draws whole device
 * pixels no wider than its unsnapped span. A decimated window's buckets hold different counts of
 * slots and tile the plot with no gap, so their columns share their edges.
 *
 * @param frame - The vertical frame.
 * @param topology - The entries' topology.
 * @param values - The entries' numbers, at rest or in a tween frame.
 * @param placeOf - Whether an entry's column owns its stack side's pixel floor in this frame: the
 *   stack floors' decision for a stacked series, and the entry's resting place by default.
 * @param bodies - Each entry's column with no floor, where the caller snapped it for the stack
 *   floors already, so the drawing floors it only where it owns the floor.
 * @returns What each path and emphasis box draws.
 */
export function columnsDrawing(
  frame: PlotFrame,
  topology: ColumnTopology,
  values: MarkValues,
  placeOf: (entry: ColumnEntry, index: number) => StackPlace = (entry) => entry.place,
  bodies?: readonly (PlotRect | undefined)[]
): ColumnsDrawing {
  const fillCount = Math.max(0, ...topology.entries.map((entry) => entry.fill + 1));
  const steps = () => Array.from({ length: fillCount }, (): PlotRect[] => []);
  const paths = { fill: steps(), estimated: steps(), projected: steps() } satisfies Record<
    ColumnPart,
    PlotRect[][]
  >;
  const emphasis: PlotRect[] = [];
  let missing = "";
  /** The band of the slot a coordinate along the slot axis lies in. */
  const bandAt = (along: number) => slotBandAt(frame, along, "band");
  topology.entries.forEach((entry, index) => {
    const at = (offset: number) => values[index * COLUMN_STRIDE + offset] ?? 0;
    const place = placeOf(entry, index);
    const ends = columnEnds(values, index, entry);
    const plain = bodies?.[index] ?? columnBody(frame, values, index, entry);
    const rect = place === "outer" ? floorBody(frame, plain, ends) : plain;
    const drawn = entry.fill >= 0 && (!entry.leaving || rect.height > 0);
    if (drawn) paths[entry.part][entry.fill]?.push(rect);
    if (entry.missing) {
      // The tick keeps its pixel in the band of the slot its own middle lies in. That middle is
      // unsnapped, where the column's middle is snapped, and a slot narrower than a device pixel
      // can snap a column's middle into the next slot's band.
      const [from, to] = snapBarSpan(frame, at(5), at(6), bandAt((at(5) + at(6)) / 2));
      missing += `M${String(from)} ${String(missingTickAt(frame, at(4)))}H${String(to)}`;
    }
    if (entry.emphasis) {
      const box = frameRect(frame, emphasisSpan(frame, values, index), ends);
      emphasis.push(place === "outer" ? floorBody(frame, box, ends) : box);
    }
  });
  return {
    fill: paths.fill.map((rects) => rectsPath(rects)),
    estimated: paths.estimated.map((rects) => rectsPath(rects)),
    projected: paths.projected.map((rects) => rectsPath(rects)),
    missing,
    emphasis,
  };
}

/**
 * One entry's column in a frame with no value-axis pixel floor, every edge on the device pixel
 * grid, which `floorBody` floors where the column owns its stack side's floor. A column of one slot
 * keeps its pixel among the pixels of the slot its middle lies in, as a bar does.
 *
 * @param frame - The vertical frame.
 * @param values - The entries' numbers.
 * @param index - The entry's index among them.
 * @param entry - The entry.
 * @returns The column's rectangle.
 */
export function columnBody(
  frame: PlotFrame,
  values: MarkValues,
  index: number,
  entry: ColumnEntry
): PlotRect {
  const at = (offset: number) => values[index * COLUMN_STRIDE + offset] ?? 0;
  const columnSpan = frame.count > DECIMATE_ABOVE ? snapSpan : snapBarSpan;
  const span = columnSpan(frame, at(2), at(3), slotBandAt(frame, at(0), "band"));
  return frameRect(frame, span, columnEnds(values, index, entry));
}

/**
 * An entry's emphasis box span along the slot axis in a frame, snapped among the pixels of the slot
 * its column's middle lies in.
 *
 * @param frame - The vertical frame.
 * @param values - The entries' numbers.
 * @param index - The entry's index among them.
 * @returns The span's start and end.
 */
export function emphasisSpan(frame: PlotFrame, values: MarkValues, index: number): readonly [number, number] {
  const at = (offset: number) => values[index * COLUMN_STRIDE + offset] ?? 0;
  return snapBarSpan(frame, at(7), at(8), slotBandAt(frame, at(0), "band"));
}

/**
 * An entry's column base and far end in a frame, as `baseAt` names them.
 *
 * @param values - The entries' numbers.
 * @param index - The entry's index among them.
 * @param entry - The entry.
 * @returns The base and the far end, unsnapped.
 */
export function columnEnds(
  values: MarkValues,
  index: number,
  entry: ColumnEntry
): readonly [base: number, tip: number] {
  const upper = values[index * COLUMN_STRIDE + 1] ?? 0;
  const lower = values[index * COLUMN_STRIDE + 4] ?? 0;
  return entry.baseAt === 4 ? [lower, upper] : [upper, lower];
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
        baseAt: 4,
        fill: -1,
        part: "fill",
        missing: false,
        emphasis: false,
        leaving: false,
        place: "outer",
      },
    of: (entries) => ({ count: entries.length, entries }),
    // A column whose reading leaves keeps its old paint while it shrinks to the zero line, so it
    // never vanishes from the frame it last drew in, and draws in no path once it rests at 0.
    keep: (old, next) =>
      next.fill === -1 ? { ...next, fill: old.fill, part: old.part, leaving: true } : next,
    shift: (vertex, by) => vertex.map((value, index) => (along.has(index) ? value + by * step : value)),
    // Only a decimated window's tick or box is an entry of one layout inside the window.
    flat: (vertex, entry) =>
      entry.fill === -1 && (entry.missing || entry.emphasis)
        ? vertex.map((value, index) => (index === 1 || index === 4 ? zero : value))
        : undefined,
  };
}
