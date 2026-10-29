/**
 * The cartesian chart's data model, computed during render from Root's props alone, so the server
 * HTML is the final chart and Root never inspects its children. It places the rows on the x domain,
 * reads each series' state per slot, stacks the series that share a `stack` id and measures the
 * default layout's value domain over the effective window.
 */
import type { ChartRow, ChartScalar } from "../chart-types";
import type { Interval } from "../format/time-format";
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
    const result = readSeries(
      { values: column(key), qualities: column(config.qualityKey) },
      slots,
      time?.now
    );
    for (const issue of result.issues) issues.push({ ...issue, key });
    return { key, readings: result.readings };
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
  const series = read.map(({ key, readings }, seriesIndex): SeriesModel => ({
    key,
    seriesIndex,
    stack: stackedKey.get(key),
    readings,
    extents: extents.get(key) ?? [],
    projectedFrom: projectedSlot(domain, configOf.get(key)?.projectedFrom),
  }));
  const empty = !read.some(({ readings }) => readings.some((reading) => reading.kind === "reading"));
  const windowed = function* (span: SlotWindow): Generator<number> {
    for (const { extents: list, readings, stack } of series) {
      for (let slot = span.first; slot <= span.last; slot += 1) {
        const extent = list[slot];
        const reading = readings[slot];
        // An unstacked key reaches its value only, so a "none" baseline can leave 0 out.
        if (stack === undefined && input.stackOffset === "diverging") {
          if (reading?.kind === "reading") yield reading.value;
        } else if (extent) {
          yield* extent;
        }
      }
    }
  };
  const y =
    empty || window === null
      ? EMPTY_DOMAIN
      : valueDomain({ values: windowed(window), baseline: input.baseline, include: input.include });
  return { domain, rowAt, window, series, stacks, y, empty, issues };
}
