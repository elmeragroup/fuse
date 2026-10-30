/**
 * The cartesian chart's data model, computed during render from Root's props alone, so the server
 * HTML is the final chart and Root never inspects its children. It places the rows on the x domain,
 * reads each series' state per slot, stacks the series that share a `stack` id and measures the
 * default layout's value domain over the effective window.
 */
import type { ChartRow, ChartScalar } from "../chart-types";
import type { Interval } from "../format/time-format";
import { coarseSlots } from "./coarse-slots";
import type { CoarseSlots } from "./coarse-slots";
import type { CellIssue, Reading } from "./readings";
import { readSeries } from "./readings";
import { effectiveWindow } from "./slot-window";
import type { SlotWindow } from "./slot-window";
import { stackSeries } from "./stack";
import type { Extent, StackOffset } from "./stack";
import { EMPTY_DOMAIN, valueDomain } from "./value-domain";
import type { Baseline, ValueDomain } from "./value-domain";
import { placeCategoryRows, placeTimeRows, projectedSlot } from "./x-domain";
import type { RowIssue, XDomain } from "./x-domain";

/** The fields of one config entry the model reads. */
export type ModelSeriesConfig = {
  readonly stack?: string | undefined;
  readonly qualityKey?: string | undefined;
  readonly projectedFrom?: ChartScalar | undefined;
  /** The series' own interval, coarser than Root's on a time axis, which Root checks nests. */
  readonly interval?: Interval | undefined;
};

/** What the model reads from Root's props. */
export type ModelInput = {
  readonly rows: readonly ChartRow[];
  /** The config keys in config order, with the fields the model reads. */
  readonly series: readonly (readonly [key: string, config: ModelSeriesConfig])[];
  readonly xKey: string;
  /** A time axis's interval, zone, period and `now`. A category axis passes none. */
  readonly time?:
    | {
        readonly interval: Interval;
        readonly timeZone: string;
        readonly period?: readonly [number, number] | undefined;
        readonly now?: number | undefined;
      }
    | undefined;
  readonly stackOffset: StackOffset;
  readonly baseline: Baseline;
  readonly include: readonly number[];
  /** Root's effective `xRange` input, the first and last x. */
  readonly xRange?: readonly [ChartScalar, ChartScalar] | undefined;
};

/** One config key's place in the model. */
export type SeriesModel = {
  readonly key: string;
  /** The key's position in config order, which the dim rules and the series focus read. */
  readonly seriesIndex: number;
  /** The stack id the key shares with at least one other key, or undefined. */
  readonly stack: string | undefined;
  /** The key's state at each slot. */
  readonly readings: readonly Reading[];
  /** The value-axis extent the key draws at each slot, null where it has no reading. */
  readonly extents: readonly Extent[];
  /** The first slot at or after config `projectedFrom`, or the slot count when nothing is projected. */
  readonly projectedFrom: number;
  /**
   * Where the series' own slots lie on Root's grid when its interval is coarser than Root's, or
   * undefined. A coarse series holds its slot's reading at every Root slot the slot covers.
   */
  readonly coarse: CoarseSlots | undefined;
};

/** A data rule the model met, with its production fallback already applied. */
export type ModelIssue =
  | RowIssue
  | (CellIssue & { readonly key: string })
  | { readonly rule: "mixed-sign-expand"; readonly slot: number };

/** The model of a cartesian chart. */
export type CartesianModel = {
  readonly domain: XDomain;
  /** The row each slot reads, by slot index. */
  readonly rowAt: readonly (number | undefined)[];
  /** The effective window, or null for an empty domain. */
  readonly window: SlotWindow | null;
  readonly series: readonly SeriesModel[];
  /** The stacks that hold two or more keys, in config order of their first key. */
  readonly stacks: readonly { readonly id: string; readonly keys: readonly string[] }[];
  /** The default layout's value domain, over the rows inside the effective window. */
  readonly y: ValueDomain;
  /** True when no slot holds a reading for any config key. */
  readonly empty: boolean;
  readonly issues: readonly ModelIssue[];
};

/**
 * Build the model of a cartesian chart.
 *
 * @param input - Root's data, config, axis and layout props.
 * @returns The model with every issue it met.
 */
export function buildCartesianModel(input: ModelInput): CartesianModel {
  const { rows, series: entries, xKey, time } = input;
  const xs = rows.map((row) => row[xKey]);
  const placed = time === undefined ? placeCategoryRows(xs) : placeTimeRows(xs, time);
  const { domain, rowAt } = placed;
  const issues: ModelIssue[] = [...placed.issues];
  const slots = domain.kind === "time" ? domain : undefined;
  const rowsAt = rowAt.map((row) => (row === undefined ? undefined : rows[row]));
  const column = (name: string | undefined): ChartScalar[] =>
    rowsAt.map((row) => (name === undefined ? undefined : row?.[name]));
  const read = entries.map(([key, config]) => {
    const coarse =
      slots === undefined || config.interval === undefined || config.interval === slots.interval
        ? undefined
        : coarseSlots(slots.starts, config.interval, slots.timeZone);
    if (coarse === undefined || slots === undefined) {
      const result = readSeries(
        { values: column(key), qualities: column(config.qualityKey) },
        slots,
        time?.now
      );
      for (const issue of result.issues) issues.push({ ...issue, key });
      return { key, readings: result.readings, coarse };
    }
    const own = readCoarse(column(key), column(config.qualityKey), coarse, slots, rowAt, time?.now);
    issues.push(...own.offGrid);
    for (const issue of own.issues) issues.push({ ...issue, key });
    return { key, readings: own.readings, coarse };
  });
  const stackOf = new Map<string, string[]>();
  for (const [key, config] of entries) {
    if (config.stack === undefined) continue;
    stackOf.set(config.stack, [...(stackOf.get(config.stack) ?? []), key]);
  }
  const stacks = [...stackOf].filter(([, keys]) => keys.length > 1).map(([id, keys]) => ({ id, keys }));
  const stackedKey = new Map(stacks.flatMap(({ id, keys }) => keys.map((key) => [key, id] as const)));
  const groups = [
    ...stacks.map(({ keys }) => keys),
    ...entries.flatMap(([key]) => (stackedKey.has(key) ? [] : [[key]])),
  ];
  const extents = new Map<string, readonly Extent[]>();
  for (const keys of groups) {
    const members = read.filter(({ key }) => keys.includes(key));
    const result = stackSeries(
      members.map(({ readings }) =>
        readings.map((reading) => (reading.kind === "reading" ? reading.value : null))
      ),
      input.stackOffset
    );
    // A one-key group holds one value per slot, so only a real stack can mix signs.
    for (const slot of result.mixedSignSlots) issues.push({ rule: "mixed-sign-expand", slot });
    members.forEach(({ key }, position) => {
      const list = result.extents[position];
      if (list) extents.set(key, list);
    });
  }
  const window = effectiveWindow(domain, input.xRange);
  const configOf = new Map(entries);
  const series = read.map(({ key, readings, coarse }, seriesIndex): SeriesModel => ({
    key,
    seriesIndex,
    stack: stackedKey.get(key),
    readings,
    extents: extents.get(key) ?? [],
    projectedFrom: projectedSlot(domain, configOf.get(key)?.projectedFrom),
    coarse,
  }));
  const empty = !read.some(({ readings }) => readings.some((reading) => reading.kind === "reading"));
  const drawn = { window, series, empty, stackOffset: input.stackOffset };
  const y = layoutDomain(drawn, {
    keys: entries.map(([key]) => key),
    baseline: input.baseline,
    include: input.include,
  });
  return { domain, rowAt, window, series, stacks, y, empty, issues };
}

/** A coarse series' readings by Root slot, the cell issues of its own slots, and its off-grid rows. */
type CoarseReading = {
  readonly readings: readonly Reading[];
  readonly issues: readonly CellIssue[];
  readonly offGrid: readonly RowIssue[];
};

/**
 * Read a coarse series: one cell per coarse slot, the one on the row at the slot's own start. A
 * value on any other row of the slot is off the series' grid, `off-grid-x`, as is the slot's first
 * row when the domain starts inside the slot, and in production it moves to the slot that contains
 * it when the start row holds none. Each coarse slot's state comes from its own start and end
 * against `now`, which can lie past the domain's ends, and every Root slot it covers holds it.
 */
function readCoarse(
  values: readonly ChartScalar[],
  qualities: readonly ChartScalar[],
  coarse: CoarseSlots,
  slots: { readonly starts: readonly number[]; readonly ends: readonly number[] },
  rowAt: readonly (number | undefined)[],
  now: number | undefined
): CoarseReading {
  const firsts = coarse.first.flatMap((first, slot) => (first === slot ? [slot] : []));
  const offGrid: RowIssue[] = [];
  const cells = firsts.map((first) => {
    // The slot's start row, which a domain that starts inside the slot lacks.
    const own = slots.starts[first] === coarse.start[first] ? first : -1;
    let value = own === -1 ? undefined : values[own];
    let quality = own === -1 ? undefined : qualities[own];
    for (let slot = first; slot <= (coarse.last[first] ?? first); slot += 1) {
      const cell = values[slot];
      if (slot === own || cell === undefined || cell === null) continue;
      offGrid.push({ rule: "off-grid-x", row: rowAt[slot] ?? slot });
      if (value === undefined || value === null) {
        value = cell;
        quality = qualities[slot];
      }
    }
    return { value, quality };
  });
  const result = readSeries(
    { values: cells.map(({ value }) => value), qualities: cells.map(({ quality }) => quality) },
    {
      starts: firsts.map((first) => coarse.start[first] ?? 0),
      ends: firsts.map((first) => coarse.end[first] ?? 0),
    },
    now
  );
  const indexOf = new Map(firsts.map((first, index) => [first, index]));
  return {
    readings: coarse.first.map((first) => result.readings[indexOf.get(first) ?? 0] ?? { kind: "pending" }),
    issues: result.issues.map((issue) => ({ ...issue, slot: firsts[issue.slot] ?? issue.slot })),
    offGrid,
  };
}

/** What a layout covers: its config keys, its baseline and the values it must reach. */
export type LayoutInput = {
  readonly keys: readonly string[];
  readonly baseline: Baseline;
  readonly include: readonly number[];
};

/**
 * One layout's value domain over the rows inside the effective window, as CONTRACT section 8.3
 * gives it: Root's default layout over every config key, a Panel over its `series`. A stacked key
 * reaches its stack's ends and an unstacked key its value, so a "none" baseline can leave 0 out.
 * It reads the model alone, so a Panel computes it during render and the server agrees.
 *
 * @param model - The model's window, series, emptiness and stack offset.
 * @param layout - The layout's keys, baseline and `yInclude`.
 * @returns The niced domain and its ticks, `[0, 1]` when the chart is empty.
 */
export function layoutDomain(
  model: Pick<CartesianModel, "window" | "series" | "empty"> & { readonly stackOffset: StackOffset },
  layout: LayoutInput
): ValueDomain {
  const { window } = model;
  if (model.empty || window === null) return EMPTY_DOMAIN;
  const keys = new Set(layout.keys);
  const members = model.series.filter(({ key }) => keys.has(key));
  const values = function* (): Generator<number> {
    for (const { extents: list, readings, stack } of members) {
      for (let slot = window.first; slot <= window.last; slot += 1) {
        const extent = list[slot];
        const reading = readings[slot];
        if (stack === undefined && model.stackOffset === "diverging") {
          if (reading?.kind === "reading") yield reading.value;
        } else if (extent) {
          yield* extent;
        }
      }
    }
  };
  return valueDomain({ values: values(), baseline: layout.baseline, include: layout.include });
}
