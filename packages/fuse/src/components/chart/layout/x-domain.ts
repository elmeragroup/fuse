/**
 * The x domain of a cartesian chart, as CONTRACT section 8.6 defines it. A time axis lists every
 * slot from the first row to the last, or every slot of `period`, so gaps stay visible. A slot
 * comes from its start and the interval only, and Fuse never reads an end field. A category axis
 * lists the categories in data order.
 */
import type { ChartScalar } from "../chart-types";
import { nextSlotStart, slotStart, slotStartsFrom, wallClock } from "../format/time-format";
import type { Interval, WallClock } from "../format/time-format";
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
      /** Each slot start's wall clock in the zone, read once with the domain. */
      readonly walls: readonly WallClock[];
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

/** Every slot start from `first` up to and including `last`. */
function slotsBetween(first: number, last: number, interval: Interval, timeZone: string): number[] {
  return slotStartsFrom(first, (start) => start > last, interval, timeZone);
}

/** Every slot start inside a half-open period. */
function periodSlots(period: readonly [number, number], interval: Interval, timeZone: string): number[] {
  const [from, to] = period;
  let first = slotStart(from, interval, timeZone);
  if (first < from) first = nextSlotStart(first, interval, timeZone);
  return slotStartsFrom(first, (start) => start >= to, interval, timeZone);
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
  const { interval, timeZone, period } = options;
  const issues: RowIssue[] = [];
  const placed: { readonly row: number; readonly start: number }[] = [];
  xs.forEach((x, row) => {
    const instant = instantOf(x);
    if (Number.isNaN(instant)) {
      issues.push({ rule: "invalid-x", row });
      return;
    }
    if (period !== undefined && (instant < period[0] || instant >= period[1])) {
      issues.push({ rule: "row-outside-period", row });
      return;
    }
    const start = slotStart(instant, interval, timeZone);
    if (start !== instant) issues.push({ rule: "off-grid-x", row });
    placed.push({ row, start });
  });
  let starts: number[] = [];
  if (period !== undefined) {
    starts = periodSlots(period, interval, timeZone);
  } else if (placed.length > 0) {
    let first = Number.POSITIVE_INFINITY;
    let last = Number.NEGATIVE_INFINITY;
    for (const { start } of placed) {
      first = Math.min(first, start);
      last = Math.max(last, start);
    }
    starts = slotsBetween(first, last, interval, timeZone);
  }
  const firstRow = new Map<number, number>();
  for (const { row, start } of placed) {
    if (firstRow.has(start)) issues.push({ rule: "duplicate-x", row });
    else firstRow.set(start, row);
  }
  const rowAt = starts.map((start) => firstRow.get(start));
  issues.sort((a, b) => a.row - b.row);
  const ends = starts.map((start, slot) => starts[slot + 1] ?? nextSlotStart(start, interval, timeZone));
  const walls = starts.map((start) => wallClock(start, timeZone));
  return { domain: { kind: "time", interval, timeZone, starts, ends, walls }, rowAt, issues };
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
