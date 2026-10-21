// The filter predicates, shared by the client filter function and a server that filters rows in
// memory. Pure, with no directive.

import type { FilterOperator, FilterValue, IsoDate } from "./filter-model";
import { isFiniteNumber, isIsoDate, isString } from "./filter-model";

/** Options every predicate takes. */
export type MatchOptions = {
  /** The zone a `Date` cell's calendar day is read in. Defaults to the runtime zone. */
  readonly timeZone?: string | undefined;
};

/** The operators a missing cell passes, since it holds none of the values. */
const NEGATED: ReadonlySet<FilterOperator> = new Set<FilterOperator>([
  "isNot",
  "isNoneOf",
  "excludes",
  "excludesAnyOf",
  "excludesAllOf",
  "doesNotContain",
  "isNotBetween",
]);

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
  const key = timeZone ?? "";
  let formatter = dayFormatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(key, formatter);
  }
  const parts = new Map(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.get("year") ?? ""}-${parts.get("month") ?? ""}-${parts.get("day") ?? ""}`;
}

type OrderedOperator = Extract<FilterValue, { readonly kind: "number" | "date" }>["operator"];

/** Number and date operators, over numbers or ISO dates, which order the same way as text. */
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
      return cell === first;
    case "isNot":
      return cell !== first;
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
      return second !== undefined && cell >= first && cell <= second;
    case "isNotBetween":
      return second === undefined || cell < first || cell > second;
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
  if (cell === null || cell === undefined) {
    return NEGATED.has(value.operator);
  }
  switch (value.kind) {
    case "option": {
      const hit = isString(cell) && value.values.includes(cell);
      return value.operator === "is" || value.operator === "isAnyOf" ? hit : !hit;
    }
    case "multiOption": {
      const present = new Set(Array.isArray(cell) ? cell.filter(isString) : []);
      const some = value.values.some((item) => present.has(item));
      const every = value.values.every((item) => present.has(item));
      switch (value.operator) {
        case "includes":
        case "includesAnyOf":
          return some;
        case "includesAllOf":
          return every;
        case "excludes":
        case "excludesAnyOf":
          return !some;
        case "excludesAllOf":
          return !every;
      }
      return false;
    }
    case "text": {
      const text = isString(cell) ? cell : isFiniteNumber(cell) ? String(cell) : null;
      if (text === null) {
        return NEGATED.has(value.operator);
      }
      const hit = normalizeText(text).includes(normalizeText(value.values[0]));
      return value.operator === "contains" ? hit : !hit;
    }
    case "number":
      return isFiniteNumber(cell)
        ? compareOrdered(value.operator, cell, value.values)
        : NEGATED.has(value.operator);
    case "date": {
      const day =
        cell instanceof Date && !Number.isNaN(cell.getTime())
          ? calendarDateIn(cell, options.timeZone)
          : isIsoDate(cell)
            ? cell
            : null;
      return day === null ? NEGATED.has(value.operator) : compareOrdered(value.operator, day, value.values);
    }
  }
}
