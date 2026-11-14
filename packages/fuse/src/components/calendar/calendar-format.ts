// The text a calendar writes: day numbers, full day names, month names and the visible range.
// Every format goes through `Intl.DateTimeFormat` on a UTC instant at the day's midnight, formatted
// in UTC, so the text names the same day in every engine and process time zone. A Temporal value
// is not passed to `Intl` directly: a polyfilled Temporal's objects only format through the
// polyfill's replacement `Intl.DateTimeFormat`, which a host may not have installed.

import { dateTimeFormat } from "../../internal/intl-cache";
import { canonicalSpaces } from "../../intl/canonical-spaces";
import type { SupportedLocale } from "../../intl/locale-context";
import { weekdayStyle } from "./weekday-style";

/** The instant at a day's UTC midnight, for `Intl` to format in UTC. */
function utcMidnight(date: { readonly year: number; readonly month: number; readonly day: number }): Date {
  const instant = new Date(0);
  // `setUTCFullYear` rather than `Date.UTC`, which maps the years 0 to 99 onto 1900 to 1999.
  instant.setUTCFullYear(date.year, date.month - 1, date.day);
  return instant;
}

/** The instant at a month's first day, for `Intl` to format the month in UTC. */
function monthStart(month: Temporal.PlainYearMonth): Date {
  return utcMidnight({ year: month.year, month: month.month, day: 1 });
}

/**
 * A day's number as the locale writes it in a grid, such as `12`: the day field alone, without
 * the period nb-NO writes after a day standing by itself ("12."), as React Aria takes it.
 *
 * @param locale - The locale.
 * @param date - The day.
 * @returns The day of the month.
 */
export function formatDayNumber(locale: string, date: Temporal.PlainDate): string {
  const parts = dateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).formatToParts(utcMidnight(date));
  return parts.find((part) => part.type === "day")?.value ?? String(date.day);
}

/** A day's full name: weekday, day, month and year, read at UTC midnight. */
const DAY_NAME_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
};

/**
 * A day's full name, as React Aria names a day button before its prefixes and suffixes, such as
 * `Monday, October 12, 2026` in en-US.
 *
 * @param locale - The locale.
 * @param date - The day.
 * @returns The weekday, day, month and year.
 */
export function formatDayName(locale: string, date: Temporal.PlainDate): string {
  return dateTimeFormat(locale, DAY_NAME_OPTIONS).format(utcMidnight(date));
}

/**
 * A month and its year, such as `October 2026` in en-US.
 *
 * @param locale - The locale.
 * @param month - The month.
 * @returns The month's name and year.
 */
export function formatMonth(locale: string, month: Temporal.PlainYearMonth): string {
  return dateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    monthStart(month)
  );
}

/**
 * How each locale joins the two ends of a range: CLDR's interval fallback pattern, `{0} – {1}` in
 * en-US and `{0}–{1}` in the Nordic locales. Fuse joins the ends itself rather than calling
 * `Intl.DateTimeFormat#formatRange`, whose shortening differs by engine (Firefox writes fi-FI's
 * October–December 2026 as "loka–joulukuu 2026", Chromium and WebKit as "lokakuu
 * 2026–joulukuu 2026"). A locale added to `SupportedLocale` fails to compile here until it has one.
 */
const RANGE_SEPARATOR = {
  "en-US": " – ",
  "nb-NO": "–",
  "sv-SE": "–",
  "fi-FI": "–",
} as const satisfies Record<SupportedLocale, string>;

/**
 * The visible months as one range, such as `October – December 2026` in en-US, or one month's
 * name when only one shows. It writes the same text in every engine: each end is the locale's own
 * month name, with its year (`{ month: "long", year: "numeric" }`), or, for a start in the end's
 * year, the stand-alone month name alone (`{ month: "long" }`), so a shared year is written once,
 * joined by the locale's `RANGE_SEPARATOR`. Its spaces are no-break spaces, so a server and a
 * browser whose Intl data space a month and year differently still hydrate alike.
 *
 * @param locale - A locale Fuse supports.
 * @param start - The first visible month.
 * @param end - The last visible month, the same as `start` for a one-month view.
 * @returns The range.
 */
export function formatMonthRange(
  locale: SupportedLocale,
  start: Temporal.PlainYearMonth,
  end: Temporal.PlainYearMonth
): string {
  const last = formatMonth(locale, end);
  if (start.equals(end)) {
    return canonicalSpaces(last);
  }
  const first =
    start.year === end.year
      ? dateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(monthStart(start))
      : formatMonth(locale, start);
  return canonicalSpaces(`${first}${RANGE_SEPARATOR[locale]}${last}`);
}

/**
 * A weekday's column label: the locale's short name, such as `Mon`, where it fits a grid column,
 * and its narrow form otherwise. The full form comes from `Intl`, never a first letter, so a
 * locale whose short names start alike keeps them apart.
 *
 * @param locale - The locale.
 * @param date - Any day on that weekday.
 * @returns The label.
 */
export function formatWeekday(locale: string, date: Temporal.PlainDate): string {
  return dateTimeFormat(locale, { weekday: weekdayStyle(locale), timeZone: "UTC" }).format(utcMidnight(date));
}

/**
 * A weekday's full name, such as `Monday`, for the column header's abbreviation expansion.
 *
 * @param locale - The locale.
 * @param date - Any day on that weekday.
 * @returns The weekday's long name.
 */
export function formatWeekdayName(locale: string, date: Temporal.PlainDate): string {
  return dateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(utcMidnight(date));
}

/**
 * A day's full name without its year, as a range writes its start when the end already writes
 * that year: `Monday, October 5` in en-US. It is the full name's parts with the year and the
 * literal that joins it to the rest left out, so the weekday keeps the case the full date gives it
 * (fi-FI "maanantaina 5. lokakuuta", where a year-less pattern writes "maanantai"). `RangeCalendar`
 * formats each end on its own and joins them with its own word ("to"), as React Aria does. React
 * Aria splits `Intl.DateTimeFormat#formatRangeToParts` instead, whose shared parts differ between
 * engines (a shared month dropped in some locales, Chromium's zero-padded sv-SE days), so this
 * keeps the month on both ends and writes the same text in every engine. The en-US text matches
 * React Aria's, which the parity harness pins (D-3-19).
 *
 * @param locale - The locale.
 * @param date - The day.
 * @returns The weekday, day and month, in the full name's own words.
 */
export function formatDayNameWithoutYear(locale: string, date: Temporal.PlainDate): string {
  const parts = dateTimeFormat(locale, DAY_NAME_OPTIONS).formatToParts(utcMidnight(date));
  const year = parts.findIndex((part) => part.type === "year");
  // The literal before a trailing year, or after a leading one, goes with it.
  const joiner = parts[year - 1]?.type === "literal" ? year - 1 : year + 1;
  return parts
    .filter((_, index) => year === -1 || (index !== year && index !== joiner))
    .map((part) => part.value)
    .join("");
}
