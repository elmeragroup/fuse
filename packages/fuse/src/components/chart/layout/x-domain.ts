/**
 * The x domain of a cartesian chart, as CONTRACT section 8.6 defines it. A time axis lists every
 * slot from the first row to the last, or every slot of `period`, so gaps stay visible. A slot
 * comes from its start and the interval only, and Fuse never reads an end field. A category axis
 * lists the categories in data order.
 */
import type { ChartScalar } from "../chart-types";
import {
  DAY,
  SUB_DAY_MS,
  nextSlotStart,
  slotStart,
  slotStarter,
  slotStartsFrom,
} from "../format/time-format";
import type { Interval } from "../format/time-format";
import { ChartCompositionError } from "./errors";
import { sameItems } from "./same-items";
import { numberOf, stringOf } from "./scalar";

/** The slots of an axis. */
export type XDomain =
  | {
      readonly kind: "time";
      readonly interval: Interval;
      readonly timeZone: string;
      /** Each slot's start instant in epoch milliseconds, ascending. */
      readonly starts: readonly number[];
      /** Each slot's end, which is the next slot's start. */
      readonly ends: readonly number[];
    }
  | {
      readonly kind: "category";
      /** The categories in data order. */
      readonly names: readonly string[];
    };

/** A data rule a row broke while the axis placed it, with the production fallback already applied. */
export type RowIssue = {
  /** The rule, as CONTRACT section 8.1 names it. */
  readonly rule: "invalid-x" | "off-grid-x" | "duplicate-x" | "row-outside-period";
  /** The row's index in `data`. */
  readonly row: number;
};

/** The rows placed on their slots. */
export type PlacedRows = {
  readonly domain: XDomain;
  /** The row each slot reads, by slot index, or undefined for a slot with no row. */
  readonly rowAt: readonly (number | undefined)[];
  /** The rules the rows broke, in row order. */
  readonly issues: readonly RowIssue[];
};

/** How a time axis reads its rows. */
export type TimeAxisOptions = {
  readonly interval: Interval;
  readonly timeZone: string;
  /** The half-open window the axis lists, in epoch milliseconds. */
  readonly period?: readonly [start: number, end: number];
};

/**
 * The instant a time-axis cell holds. Strings never make an instant, because a date-only string
 * parses as UTC midnight and lands on the wrong day in New York.
 *
 * @param value - A data cell.
 * @returns The epoch milliseconds, or NaN when the cell holds no valid instant.
 */
export function instantOf(value: ChartScalar): number {
  if (value instanceof Date) return value.getTime();
  const number = numberOf(value);
  return number !== undefined && Number.isFinite(number) ? number : Number.NaN;
}

/**
 * The most slots one time axis may list. The largest axis a demo or test draws has 100,000
 * slots, and a year of minutes, 525,600, fits with room to spare. A finer interval over a long
 * range, such as seconds over a year (31,536,000), would build slots until the tab runs out of
 * memory, so the axis refuses it instead.
 */
const SLOT_LIMIT = 1_000_000;

const HOUR = SUB_DAY_MS.hour;

/**
 * Each interval's slot length, the shortest one for the calendar intervals: a clock change can
 * shorten a day by an hour, and a month is at least 28 days. A sub-day slot can also end early at
 * a day's start, which adds at most one slot a day, far below the limit's headroom.
 */
const SLOT_LENGTH = {
  ...SUB_DAY_MS,
  day: DAY - HOUR,
  week: 7 * DAY - HOUR,
  month: 28 * DAY - HOUR,
  year: 365 * DAY - HOUR,
} as const satisfies Readonly<Record<Interval, number>>;

/** A span in words, such as `365 days` or `6 hours`. */
function describeSpan(span: number): string {
  const days = span / DAY;
  if (days >= 1) return `${Math.round(days).toLocaleString("en-US")} days`;
  return `${Math.max(1, Math.round(span / HOUR)).toLocaleString("en-US")} hours`;
}

/**
 * Throws when an axis from `from` to `to` would list more than `SLOT_LIMIT` slots. It counts by
 * arithmetic, before any slot exists. A bound that is no instant, as an invalid `Date` in
 * `period` reads, has no count, so the axis refuses it by name.
 *
 * @throws {ChartCompositionError} `slot-limit` when the interval is too fine for the range, or a
 * bound is not a finite instant.
 */
function assertSlotCount(from: number, to: number, interval: Interval): void {
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new ChartCompositionError(
      "Chart.Root",
      "slot-limit",
      "period must be two valid instants, but one is not a valid date. Pass a period of valid dates."
    );
  }
  const span = Math.max(0, to - from);
  const count = Math.floor(span / SLOT_LENGTH[interval]) + 1;
  if (count <= SLOT_LIMIT) return;
  throw new ChartCompositionError(
    "Chart.Root",
    "slot-limit",
    `interval "${interval}" over ${describeSpan(span)} needs ${count.toLocaleString("en-US")} slots; the limit is ${SLOT_LIMIT.toLocaleString("en-US")}. Pass a coarser interval or a shorter period.`
  );
}

/**
 * Every slot start of an axis over `range`, from the slot `firstOf` picks for the range's start
 * until `done`, once the range is known to fit the slot limit. Every slot list of an axis comes
 * through here, and the check runs before any slot is computed.
 */
function listSlots(
  range: readonly [number, number],
  firstOf: (from: number) => number,
  done: (start: number) => boolean,
  interval: Interval,
  timeZone: string
): number[] {
  const [from, to] = range;
  assertSlotCount(from, to, interval);
  return slotStartsFrom(firstOf(from), done, interval, timeZone);
}

/** Every slot start from `first` up to and including `last`. */
function slotsBetween(first: number, last: number, interval: Interval, timeZone: string): number[] {
  return listSlots(
    [first, last],
    (from) => from,
    (start) => start > last,
    interval,
    timeZone
  );
}

/** Every slot start inside a half-open period. */
function periodSlots(period: readonly [number, number], interval: Interval, timeZone: string): number[] {
  const firstInside = (from: number): number => {
    const start = slotStart(from, interval, timeZone);
    return start < from ? nextSlotStart(start, interval, timeZone) : start;
  };
  return listSlots(period, firstInside, (start) => start >= period[1], interval, timeZone);
}

/**
 * Place time-axis rows on their slots.
 *
 * - A cell that is not a valid instant is `invalid-x`, and the row is dropped.
 * - An instant that is not a slot start is `off-grid-x`, and the row moves to the slot that holds it.
 * - A row outside `period` is `row-outside-period`, and the row is dropped.
 * - A second row on a slot is `duplicate-x`, and the first row in data order wins.
 *
 * @param xs - Each row's x cell, in data order.
 * @param options - The interval, the zone and the optional period.
 * @returns The domain, the row each slot reads and the issues.
 */
export function placeTimeRows(xs: readonly ChartScalar[], options: TimeAxisOptions): PlacedRows {
  return placeInstants(xs.map(instantOf), options);
}

/** Place time-axis rows by each row's instant, as `placeTimeRows` reads them. */
function placeInstants(cells: readonly number[], options: TimeAxisOptions): PlacedRows {
  const { interval, timeZone, period } = options;
  const issues: RowIssue[] = [];
  const startOf = slotStarter(interval, timeZone);
  // The rows that place, in data order, and their slot starts.
  const rows: number[] = [];
  const placed: number[] = [];
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  let ascending = true;
  for (let row = 0; row < cells.length; row += 1) {
    const instant = cells[row] ?? Number.NaN;
    if (Number.isNaN(instant)) {
      issues.push({ rule: "invalid-x", row });
      continue;
    }
    if (period !== undefined && (instant < period[0] || instant >= period[1])) {
      issues.push({ rule: "row-outside-period", row });
      continue;
    }
    const start = startOf(instant);
    if (start !== instant) issues.push({ rule: "off-grid-x", row });
    if (start <= last) ascending = false;
    first = Math.min(first, start);
    last = Math.max(last, start);
    rows.push(row);
    placed.push(start);
  }
  let starts: number[] = [];
  if (period !== undefined) starts = periodSlots(period, interval, timeZone);
  else if (placed.length > 0) starts = slotsBetween(first, last, interval, timeZone);
  const rowAt = ascending ? walkRows(starts, placed, rows) : mapRows(starts, placed, rows, issues);
  // The sort is stable, so a row's off-grid issue stays ahead of its duplicate-x, as the passes pushed them.
  issues.sort((a, b) => a.row - b.row);
  const ends = starts.map((start, slot) => starts[slot + 1] ?? nextSlotStart(start, interval, timeZone));
  return { domain: { kind: "time", interval, timeZone, starts, ends }, rowAt, issues };
}

/**
 * The row each slot reads when the placed rows' starts ascend, so no two share a slot: one walk
 * along both lists.
 */
function walkRows(
  starts: readonly number[],
  placed: readonly number[],
  rows: readonly number[]
): (number | undefined)[] {
  let next = 0;
  return starts.map((start) => {
    while (next < placed.length && (placed[next] ?? start) < start) next += 1;
    if (placed[next] !== start) return undefined;
    next += 1;
    return rows[next - 1];
  });
}

/**
 * The row each slot reads when the placed rows come in any order. The first row in data order wins
 * a slot, and each later row on it is `duplicate-x`.
 */
function mapRows(
  starts: readonly number[],
  placed: readonly number[],
  rows: readonly number[],
  issues: RowIssue[]
): (number | undefined)[] {
  const firstRow = new Map<number, number>();
  placed.forEach((start, index) => {
    const row = rows[index] ?? index;
    if (firstRow.has(start)) issues.push({ rule: "duplicate-x", row });
    else firstRow.set(start, row);
  });
  return starts.map((start) => firstRow.get(start));
}

/**
 * Place category rows in data order. A cell that is not a string is `invalid-x`, and a repeated
 * category is `duplicate-x`, where the first row wins.
 *
 * @param xs - Each row's x cell, in data order.
 * @returns The domain, the row each category reads and the issues.
 */
export function placeCategoryRows(xs: readonly ChartScalar[]): PlacedRows {
  const issues: RowIssue[] = [];
  const names: string[] = [];
  const rowAt: number[] = [];
  const seen = new Set<string>();
  xs.forEach((cell, row) => {
    const x = stringOf(cell);
    if (x === undefined) {
      issues.push({ rule: "invalid-x", row });
    } else if (seen.has(x)) {
      issues.push({ rule: "duplicate-x", row });
    } else {
      seen.add(x);
      names.push(x);
      rowAt.push(row);
    }
  });
  return { domain: { kind: "category", names }, rowAt, issues };
}

/**
 * Places rows on their slots: `placeTimeRows` on a time axis, `placeCategoryRows` on a category
 * axis.
 */
export type RowPlacer = (xs: readonly ChartScalar[], time: TimeAxisOptions | undefined) => PlacedRows;

/** What a placement reads of the rows and the axis, which alone decide it. */
type PlacedCells =
  | {
      readonly kind: "time";
      readonly interval: Interval;
      readonly timeZone: string;
      readonly period: readonly [number, number] | undefined;
      readonly instants: readonly number[];
    }
  | { readonly kind: "category"; readonly names: readonly (string | undefined)[] };

function placedCells(xs: readonly ChartScalar[], time: TimeAxisOptions | undefined): PlacedCells {
  if (time === undefined) return { kind: "category", names: xs.map(stringOf) };
  const { interval, timeZone, period } = time;
  return { kind: "time", interval, timeZone, period, instants: xs.map(instantOf) };
}

function sameCells(a: PlacedCells, b: PlacedCells): boolean {
  if (a.kind === "category") return b.kind === "category" && sameItems(a.names, b.names);
  if (b.kind === "category") return false;
  return (
    a.interval === b.interval &&
    a.timeZone === b.timeZone &&
    Object.is(a.period?.[0], b.period?.[0]) &&
    Object.is(a.period?.[1], b.period?.[1]) &&
    sameItems(a.instants, b.instants)
  );
}

/**
 * Place rows without memory, as `placeTimeRows` and `placeCategoryRows` do.
 *
 * @param xs - Each row's x cell, in data order.
 * @param time - A time axis's interval, zone and period, or undefined for a category axis.
 * @returns The domain, the row each slot reads and the issues.
 */
export function placeRows(xs: readonly ChartScalar[], time: TimeAxisOptions | undefined): PlacedRows {
  return time === undefined ? placeCategoryRows(xs) : placeTimeRows(xs, time);
}

/**
 * A row placer that hands back its last placement while the rows' x cells and the axis read the
 * same. A placement reads only the instant or the category of each row's x and the axis's
 * interval, zone and period, so a data update that keeps every x keeps the domain object, and the
 * work that reads only the domain, such as the x ticks and the slot keys, is not done again.
 *
 * @returns A placer with its own memory of one placement.
 */
export function createRowPlacer(): RowPlacer {
  let last: { readonly cells: PlacedCells; readonly placed: PlacedRows } | undefined;
  return (xs, time) => {
    const cells = placedCells(xs, time);
    if (last !== undefined && sameCells(last.cells, cells)) return last.placed;
    const placed =
      cells.kind === "time" && time !== undefined ? placeInstants(cells.instants, time) : placeRows(xs, time);
    last = { cells, placed };
    return placed;
  };
}

/** The number of slots in a domain. */
export function slotCount(domain: XDomain): number {
  return domain.kind === "time" ? domain.starts.length : domain.names.length;
}

/**
 * The slot an x value names. On a time axis any instant inside the slot finds it, and on a category
 * axis the match is exact.
 *
 * @param domain - The domain.
 * @param x - An instant on a time axis or a category string.
 * @returns The slot index, or -1 when no slot holds the value or its kind does not fit the axis.
 */
export function slotOf(domain: XDomain, x: ChartScalar): number {
  if (domain.kind === "category") {
    const name = stringOf(x);
    return name === undefined ? -1 : domain.names.indexOf(name);
  }
  const instant = instantOf(x);
  if (Number.isNaN(instant)) return -1;
  const { starts, ends } = domain;
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((starts[middle] ?? 0) > instant) high = middle - 1;
    else if ((ends[middle] ?? 0) <= instant) low = middle + 1;
    else return middle;
  }
  return -1;
}

/**
 * The first slot at or after an x, which config `projectedFrom` names. An instant before the domain
 * gives the first slot, and one after it, or a category the axis lacks, gives the slot count.
 *
 * @param domain - The domain.
 * @param x - The x, or undefined for none.
 * @returns The slot index, or the slot count when no slot lies at or after the x.
 */
export function projectedSlot(domain: XDomain, x: ChartScalar | undefined): number {
  const count = slotCount(domain);
  if (x === undefined) return count;
  if (domain.kind === "category") {
    const index = slotOf(domain, x);
    return index === -1 ? count : index;
  }
  const instant = instantOf(x);
  if (Number.isNaN(instant)) return count;
  const index = domain.ends.findIndex((end) => end > instant);
  return index === -1 ? count : index;
}

/**
 * The x a callback reports for a slot, the category or the slot start as a `Date`.
 *
 * @param domain - The domain.
 * @param slot - A slot index inside the domain.
 * @returns The category string or the start `Date`.
 */
export function slotX(domain: XDomain, slot: number): string | Date {
  return domain.kind === "category" ? (domain.names[slot] ?? "") : new Date(domain.starts[slot] ?? 0);
}
