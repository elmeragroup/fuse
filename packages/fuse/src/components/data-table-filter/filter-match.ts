// The filter predicates, shared by the client filter function and a server that filters rows in
// memory. Pure, with no directive.

import type { FilterValue, IsoDate } from "./filter-model";
import { isFiniteNumber, isIsoDate, isNegated, isString } from "./filter-model";

/** Options every predicate takes. */
export type MatchOptions = {
  /** The zone a `Date` cell's calendar day is read in. Defaults to the runtime zone. */
  readonly timeZone?: string | undefined;
};

/**
 * Lower case with accents removed, so "Café" matches "cafe". A letter of its own, such as `ø`,
 * stays.
 *
 * @param text - The text to normalize.
 * @returns The normalized text.
 */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * The calendar day an instant falls on in a time zone.
 *
 * @param date - The instant.
 * @param timeZone - The zone, or undefined for the runtime zone.
 * @returns The day as `YYYY-MM-DD`.
 */
export function calendarDateIn(date: Date, timeZone: string | undefined): IsoDate {
  if (timeZone === undefined) {
    // The runtime zone is the Date's own, so its getters read the day with no Intl call.
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }
  let formatter = dayFormatters.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timeZone, formatter);
  }
  let year = "";
  let month = "";
  let day = "";
  for (const part of formatter.formatToParts(date)) {
    if (part.type === "year") {
      year = part.value;
    } else if (part.type === "month") {
      month = part.value;
    } else if (part.type === "day") {
      day = part.value;
    }
  }
  return `${year}-${month}-${day}`;
}

// What every row of one filter pass compares against, worked out once per filter value rather
// than per row. TanStack and a server both hand each row the same value object.
const needles = new WeakMap<FilterValue, string>();
const pickedSets = new WeakMap<FilterValue, ReadonlySet<string>>();

function prepared<T>(cache: WeakMap<FilterValue, T>, value: FilterValue, prepare: () => T): T {
  let result = cache.get(value);
  if (result === undefined) {
    result = prepare();
    cache.set(value, result);
  }
  return result;
}

/** The picked option values as a set. */
function pickedOf(
  value: Extract<FilterValue, { readonly kind: "option" | "multiOption" }>
): ReadonlySet<string> {
  return prepared(pickedSets, value, () => new Set(value.values));
}

/**
 * Whether a multi-option cell holds any of the picked values, or with `all`, every one of them.
 * One walk over the cell, and only the "every" check allocates.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a cell is whatever the row holds
function holdsPicked(cell: unknown, picked: ReadonlySet<string>, all: boolean): boolean {
  const items: readonly unknown[] = Array.isArray(cell) ? cell : [];
  if (!all) {
    return items.some((item) => isString(item) && picked.has(item));
  }
  const held = new Set<string>();
  for (const item of items) {
    if (isString(item) && picked.has(item)) {
      held.add(item);
    }
  }
  return held.size === picked.size;
}

type OrderedOperator = Extract<FilterValue, { readonly kind: "number" | "date" }>["operator"];

/**
 * Number and date operators, over numbers or ISO dates, which order the same way as text. A
 * negated operator answers its positive twin, which the caller inverts.
 */
function compareOrdered<T extends number | string>(
  operator: OrderedOperator,
  cell: T,
  values: readonly T[]
): boolean {
  const [first, second] = values;
  if (first === undefined) {
    return false;
  }
  switch (operator) {
    case "is":
    case "isNot":
      return cell === first;
    case "isGreaterThan":
    case "isAfter":
      return cell > first;
    case "isGreaterThanOrEqual":
    case "isOnOrAfter":
      return cell >= first;
    case "isLessThan":
    case "isBefore":
      return cell < first;
    case "isLessThanOrEqual":
    case "isOnOrBefore":
      return cell <= first;
    case "isBetween":
    case "isNotBetween":
      return second !== undefined && cell >= first && cell <= second;
  }
}

/**
 * Whether one cell passes a filter. Option values compare exactly. Text compares case- and
 * accent-insensitively. A `Date` cell compares as its calendar day in `timeZone`, and an ISO date
 * string compares as it is. A missing cell passes only the negated operators.
 *
 * @param value - The filter.
 * @param cell - The row's value in the filtered column.
 * @param options - The time zone for date cells.
 * @returns Whether the row passes.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a cell is whatever the row holds, and this is the parse at that boundary
export function matchesFilter(value: FilterValue, cell: unknown, options: MatchOptions = {}): boolean {
  const hit = cell !== null && cell !== undefined && cellHolds(value, cell, options);
  return isNegated(value.kind, value.operator) ? !hit : hit;
}

/** Whether a present cell holds the filter's values, read in the operator's positive sense. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a cell is whatever the row holds
function cellHolds(value: FilterValue, cell: unknown, options: MatchOptions): boolean {
  switch (value.kind) {
    case "option":
      return isString(cell) && pickedOf(value).has(cell);
    case "multiOption": {
      const all = value.operator === "includesAllOf" || value.operator === "excludesAllOf";
      return holdsPicked(cell, pickedOf(value), all);
    }
    case "text": {
      const text = isString(cell) ? cell : isFiniteNumber(cell) ? String(cell) : null;
      if (text === null) {
        return false;
      }
      const needle = prepared(needles, value, () => normalizeText(value.values[0]));
      return normalizeText(text).includes(needle);
    }
    case "number":
      return isFiniteNumber(cell) && compareOrdered(value.operator, cell, value.values);
    case "date": {
      const day =
        cell instanceof Date && !Number.isNaN(cell.getTime())
          ? calendarDateIn(cell, options.timeZone)
          : isIsoDate(cell)
            ? cell
            : null;
      return day !== null && compareOrdered(value.operator, day, value.values);
    }
  }
}
