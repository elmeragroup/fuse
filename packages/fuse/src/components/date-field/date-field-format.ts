// How a date field writes itself, through Intl: the segments' order and the literals between them
// (`Intl.DateTimeFormat#formatToParts`), each segment's text and placeholder, the names a screen
// reader hears and the bound in a validation message. The options are React Aria's
// `getFormatOptions` (`@react-stately/datepicker`), so the interim tier and this one print the same
// segments. Intl never sees a Temporal object, which only a polyfill's Intl replacement formats: a
// plain value formats as UTC fields in UTC, a zoned value as its instant in its own zone.

import { dateTimeFormat } from "../../internal/intl-cache";
import { canonicalSpaces } from "../../intl/canonical-spaces";
import { formatDateTime, formatDateTimeToParts } from "../../intl/date-time-join";
import type { DateGranularity, TemporalValue } from "../../temporal/temporal-value";
import type { DateDraft, EditableSegmentType, HourCycle } from "./date-draft";
import { scopeShows } from "./date-input-scope";
import type { DateInputUnits } from "./date-input-scope";
import type { DateInputSegmentData } from "./date-input-types";

/** U+2066, which React Aria writes before a time so it reads left to right in any direction. */
export const LEFT_TO_RIGHT_ISOLATE = String.fromCodePoint(0x2066);
/** U+2069, which closes {@link LEFT_TO_RIGHT_ISOLATE} after the time's last segment. */
export const POP_DIRECTIONAL_ISOLATE = String.fromCodePoint(0x2069);

/** What a field's format depends on. */
export type FieldFormat = {
  readonly locale: string;
  /** The smallest unit shown. */
  readonly granularity: DateGranularity;
  /** The hour cycle shown, already resolved from the locale and the `hourCycle` prop. */
  readonly hourCycle: HourCycle;
  /** Whether day, month and hour pad to two digits whatever the locale writes. */
  readonly forceLeadingZeros: boolean;
  /** The zone of a zoned field, which it formats in; `undefined` for a plain one. */
  readonly timeZone: string | undefined;
  /** Whether a zoned field with a time hides its zone name. */
  readonly hideTimeZone: boolean;
  /** Whether the field shows its date and time, or its time alone from the hour. */
  readonly scope: DateInputUnits;
};

/** One part of a field, in display order. */
export type FieldPart =
  | { readonly kind: "literal"; readonly text: string }
  | { readonly kind: "segment"; readonly type: EditableSegmentType }
  | { readonly kind: "timeZoneName" };

/**
 * The hour cycle a locale shows, or the one `hourCycle` asks for. The four Fuse locales write
 * `h12` or `h23`; a locale's `h11` or `h24` reads as its nearest.
 *
 * @param locale - The locale.
 * @param hourCycle - React Aria's `hourCycle` prop: `12`, `24`, or `undefined` for the locale's.
 * @returns The hour cycle.
 */
export function resolveHourCycle(locale: string, hourCycle: 12 | 24 | undefined): HourCycle {
  if (hourCycle !== undefined) {
    return hourCycle === 12 ? "h12" : "h23";
  }
  const resolved = dateTimeFormat(locale, { hour: "numeric", timeZone: "UTC" }).resolvedOptions().hourCycle;
  return resolved === "h11" || resolved === "h12" ? "h12" : "h23";
}

type FieldOptionKey = "year" | "month" | "day" | "hour" | "minute" | "second";

const FIELD_KEYS: readonly FieldOptionKey[] = ["year", "month", "day", "hour", "minute", "second"];

/**
 * The Intl options a field writes its value with, as React Aria's `getFormatOptions`: year to
 * granularity, numeric with two-digit minutes and seconds, or two-digit days, months and hours when
 * leading zeros are forced; the zone name for a zoned field with a time unless hidden.
 *
 * @param format - The field's format.
 * @param overrides - Options that replace a field's style, such as a long month.
 * @returns The options, with the zone the field formats in.
 */
function fieldFormatOptions(
  format: FieldFormat,
  overrides: Partial<Record<FieldOptionKey, "numeric" | "2-digit" | "long">> = {}
): Intl.DateTimeFormatOptions {
  const twoDigit = format.forceLeadingZeros;
  const styles = {
    year: "numeric",
    month: twoDigit ? "2-digit" : "numeric",
    day: twoDigit ? "2-digit" : "numeric",
    hour: twoDigit ? "2-digit" : "numeric",
    minute: "2-digit",
    second: "2-digit",
    ...overrides,
  };
  const last = FIELD_KEYS.indexOf(format.granularity);
  const options: Intl.DateTimeFormatOptions = { timeZone: format.timeZone ?? "UTC" };
  for (const key of FIELD_KEYS.slice(0, last + 1).filter((unit) => scopeShows(format.scope, unit))) {
    Object.assign(options, { [key]: styles[key] });
  }
  if (format.granularity !== "day") {
    options.hourCycle = format.hourCycle;
    if (format.timeZone !== undefined && !format.hideTimeZone) {
      options.timeZoneName = "short";
    }
  }
  return options;
}

/** An instant whose UTC fields are `fields`, for years below 100 too. */
function utcInstant(fields: {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour?: number;
  readonly minute?: number;
  readonly second?: number;
}): number {
  const date = new Date(0);
  date.setUTCFullYear(fields.year, fields.month - 1, fields.day);
  date.setUTCHours(fields.hour ?? 0, fields.minute ?? 0, fields.second ?? 0, 0);
  return date.getTime();
}

/**
 * The instant Intl formats a value at: a zoned value's own instant, which the field formats in its
 * zone; a plain value's fields as UTC, which the field formats in UTC.
 *
 * @param value - The value.
 * @returns Epoch milliseconds.
 */
export function formatInstant(value: TemporalValue): number {
  return "epochMilliseconds" in value ? value.epochMilliseconds : utcInstant(value);
}

/** The instant the layout formats: one past noon, so no zone moves it to another day or period. */
const LAYOUT_INSTANT = utcInstant({ year: 2001, month: 1, day: 1, hour: 13 });

/**
 * A field's parts in display order, from `formatToParts` of the layout instant, with React Aria's
 * isolates around the time: U+2066 before the hour and U+2069 after the granularity's segment.
 * Engines write the literal between a date and a time from their own CLDR data, which differs
 * between versions, so the layout takes the join Fuse owns (`date-time-join.ts`), as the
 * validation copy does.
 *
 * @param format - The field's format.
 * @returns The parts.
 */
export function fieldParts(format: FieldFormat): FieldPart[] {
  const parts = formatDateTimeToParts(format.locale, fieldFormatOptions(format), LAYOUT_INSTANT);
  const result: FieldPart[] = [];
  for (const part of parts) {
    const type = part.type;
    switch (type) {
      case "year":
      case "month":
      case "day":
      case "hour":
      case "minute":
      case "second":
      case "dayPeriod":
        if (type === "hour") {
          result.push({ kind: "literal", text: LEFT_TO_RIGHT_ISOLATE });
        }
        result.push({ kind: "segment", type });
        if (type === format.granularity && type !== "day") {
          result.push({ kind: "literal", text: POP_DIRECTIONAL_ISOLATE });
        }
        break;
      case "timeZoneName":
        result.push({ kind: "timeZoneName" });
        break;
      default:
        result.push({ kind: "literal", text: part.value });
    }
  }
  return result;
}

/** The locale's words for before and after noon, as the field writes its day period. */
export function dayPeriodNames(locale: string): readonly [string, string] {
  const formatter = dateTimeFormat(locale, { hour: "numeric", hourCycle: "h12", timeZone: "UTC" });
  const name = (hour: number): string =>
    formatter
      .formatToParts(utcInstant({ year: 2001, month: 1, day: 1, hour }))
      .find((part) => part.type === "dayPeriod")?.value ?? "";
  return [name(0), name(12)];
}

/** React Aria's per-language placeholders for the date segments, from Chrome's and Firefox's date input. */
type DatePlaceholders = { readonly year: string; readonly month: string; readonly day: string };
const ENGLISH_PLACEHOLDERS: DatePlaceholders = { year: "yyyy", month: "mm", day: "dd" };
const DATE_PLACEHOLDERS = new Map<string, DatePlaceholders>([
  ["en", ENGLISH_PLACEHOLDERS],
  ["nb", { year: "åååå", month: "mm", day: "dd" }],
  ["sv", { year: "åååå", month: "mm", day: "dd" }],
  ["fi", { year: "vvvv", month: "kk", day: "pp" }],
]);

/** Each locale's date placeholders, read once per locale rather than per segment. */
const placeholdersByLocale = new Map<string, DatePlaceholders>();

function datePlaceholders(locale: string): DatePlaceholders {
  let placeholders = placeholdersByLocale.get(locale);
  if (placeholders === undefined) {
    placeholders = DATE_PLACEHOLDERS.get(new Intl.Locale(locale).language) ?? ENGLISH_PLACEHOLDERS;
    placeholdersByLocale.set(locale, placeholders);
  }
  return placeholders;
}

/** Two en dashes, React Aria's placeholder for every time segment. */
const TIME_PLACEHOLDER = "––";

/**
 * The text an empty segment shows: React Aria's per-language letters for the date, two en dashes
 * for the time, and the morning's word for the day period.
 *
 * @param type - The segment.
 * @param locale - The locale.
 * @returns The placeholder.
 */
function segmentPlaceholder(type: EditableSegmentType, locale: string): string {
  if (type === "year" || type === "month" || type === "day") {
    return datePlaceholders(locale)[type];
  }
  return type === "dayPeriod" ? dayPeriodNames(locale)[0] : TIME_PLACEHOLDER;
}

/**
 * The text a filled segment shows. The draft's own number is written, not a formatted value, so a
 * day typed before its month, such as 31 in February, shows as typed until the field commits.
 *
 * @param type - The segment.
 * @param draft - The draft, whose `type` is filled.
 * @param resolved - The field formatter's resolved options.
 * @param locale - The locale, for the day period's word.
 * @returns The text.
 */
function segmentText(
  type: EditableSegmentType,
  draft: DateDraft,
  resolved: Intl.ResolvedDateTimeFormatOptions,
  locale: string
): string {
  if (type === "dayPeriod") {
    return dayPeriodNames(locale)[draft.dayPeriod ?? 0];
  }
  const value = draft[type] ?? 0;
  const twoDigit =
    type === "minute" || type === "second" || (type !== "year" && resolved[type] === "2-digit");
  return twoDigit ? String(value).padStart(2, "0") : String(value);
}

/**
 * A month's long name, which a month segment adds to its spoken value.
 *
 * @param locale - The locale.
 * @param month - The month, 1–12.
 * @returns The name, such as "October".
 */
export function monthName(locale: string, month: number): string {
  return dateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
    utcInstant({ year: 2001, month, day: 1 })
  );
}

/**
 * An hour as the locale says it alone, which an hour segment speaks: "2 PM" in en-US, "14" in nb-NO.
 *
 * @param locale - The locale.
 * @param hour - The hour, 0–23.
 * @param hourCycle - The hour cycle shown.
 * @returns The text.
 */
export function hourName(locale: string, hour: number, hourCycle: HourCycle): string {
  return dateTimeFormat(locale, { hour: "numeric", hourCycle, timeZone: "UTC" }).format(
    utcInstant({ year: 2001, month: 1, day: 1, hour })
  );
}

/**
 * The zone's short name at an instant, which a zoned field shows after its time.
 *
 * @param locale - The locale.
 * @param timeZone - The zone.
 * @param instant - Epoch milliseconds, since a zone's name changes with DST.
 * @returns The name, such as "GMT+2" or "EST".
 */
function timeZoneNameText(locale: string, timeZone: string, instant: number): string {
  return (
    dateTimeFormat(locale, { timeZone, timeZoneName: "short", hour: "numeric" })
      .formatToParts(instant)
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone
  );
}

/**
 * A value written in the field's format with a long month, for the "Selected Date" description.
 * The zone's name is the one the field's segments write (see `useFieldZoneName`), so a time held on
 * the stand-in day is described in today's zone name, as it is shown. Spaces are canonical, since
 * the description is server-rendered and engines write different ones.
 *
 * @param format - The field's format.
 * @param value - The value.
 * @param zoneName - The zone's name the field writes, which replaces the value's own.
 * @returns The text, such as "October 05, 2026".
 */
export function describeValue(format: FieldFormat, value: TemporalValue, zoneName: string): string {
  return canonicalSpaces(
    formatDateTimeToParts(format.locale, fieldFormatOptions(format, { month: "long" }), formatInstant(value))
      .map((part) => (part.type === "timeZoneName" ? zoneName : part.value))
      .join("")
  );
}

/**
 * A bound as a validation message writes it, on the clock `checkBounds` compares it by: a zoned
 * field prints a zoned bound's instant in the field's zone and a plain bound's wall clock as that
 * zone's; a plain field prints any bound's own wall clock, a zoned bound's included, since a plain
 * value is compared with it there.
 *
 * @param format - The field's format.
 * @param bound - The bound, of any kind.
 * @returns The text, such as "10/31/2026, 23:30".
 */
export function formatBound(format: FieldFormat, bound: TemporalValue): string {
  let instant: number;
  if (format.timeZone === undefined) {
    instant = formatInstant("timeZoneId" in bound ? bound.toPlainDateTime() : bound);
  } else if ("epochMilliseconds" in bound) {
    instant = bound.epochMilliseconds;
  } else {
    const wallClock = "hour" in bound ? bound : bound.toPlainDateTime();
    instant = wallClock.toZonedDateTime(format.timeZone, { disambiguation: "compatible" }).epochMilliseconds;
  }
  return formatDateTime(format.locale, fieldFormatOptions(format), instant);
}

/**
 * A field's segments in display order: the literals, the zone's name and each unit, written from
 * the draft or as its placeholder.
 *
 * @param format - The field's format.
 * @param draft - What the segments show.
 * @param zoneName - The zone's name a field that writes one shows (see `zoneNameAt`).
 * @returns The segments.
 */
export function fieldSegments(
  format: FieldFormat,
  draft: DateDraft,
  zoneName: string
): DateInputSegmentData[] {
  // The number styles the field's formatter resolved, which decide whether a segment pads.
  const resolved = dateTimeFormat(format.locale, fieldFormatOptions(format)).resolvedOptions();
  return fieldParts(format).map((part, index): DateInputSegmentData => {
    switch (part.kind) {
      case "literal":
        return { type: "literal", index, text: part.text, isPlaceholder: false, isEditable: false };
      case "timeZoneName":
        return {
          type: "timeZoneName",
          index,
          text: zoneName,
          isPlaceholder: false,
          isEditable: false,
        };
      case "segment": {
        const isPlaceholder = draft[part.type] === null;
        return {
          type: part.type,
          index,
          text: isPlaceholder
            ? segmentPlaceholder(part.type, format.locale)
            : segmentText(part.type, draft, resolved, format.locale),
          isPlaceholder,
          isEditable: true,
        };
      }
    }
  });
}

/**
 * Whether a field writes its zone's name: a zoned field with a time that does not hide it.
 *
 * @param format - The field's format.
 * @returns Whether its segments hold the zone's name.
 */
export function writesZoneName(format: FieldFormat): boolean {
  return fieldFormatOptions(format).timeZoneName !== undefined;
}

/**
 * The zone's name a field writes at an instant, which changes with summer time.
 *
 * @param format - The field's format.
 * @param instant - Epoch milliseconds.
 * @returns The name, such as "GMT+2"; a plain field's is UTC's.
 */
export function zoneNameAt(format: FieldFormat, instant: number): string {
  return timeZoneNameText(format.locale, format.timeZone ?? "UTC", instant);
}

/**
 * The instant a field with no value names its zone at before it has read the clock: January 1,
 * 2001, which the server and the hydrating render write alike. The input reads today once mounted.
 */
export const EMPTY_ZONE_INSTANT = utcInstant({ year: 2001, month: 1, day: 1 });
