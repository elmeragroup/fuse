// The date presets' catalog: each key names a whole calendar period around today, or a span that
// ends today. Pure and without React, so a server imports it as it is and its ranges are
// unit-tested on their own. It computes on ISO date strings through UTC dates. Each week starts on
// the day a table gives for the four locales Fuse supports. Fuse's calendars read their week start
// from `@internationalized/date`, but lint keeps that package inside the React Aria quarantine
// (`elmera/no-rac-outside-quarantine`), and this entry never loads React Aria, so it carries its
// own table.

import type { SupportedLocale } from "../../intl/locale-context";
import type { IsoDate } from "./filter-model";

/** A preset a date field can offer. Each is a whole calendar period, or a span ending today. */
export type DatePresetKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "last7Days"
  | "last30Days"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear";

/** The presets a date field offers when it lists none. */
export const DEFAULT_DATE_PRESETS = [
  "today",
  "last7Days",
  "last30Days",
  "thisMonth",
  "thisYear",
] as const satisfies readonly DatePresetKey[];

/** A weekday as `getUTCDay` numbers it, with Sunday as 0. */
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The first day of the week in each locale Fuse supports, as CLDR gives it for the locale's
 * region. A locale added to `SupportedLocale` fails to compile here until it has a row.
 */
const WEEK_STARTS = {
  "en-US": 0,
  "nb-NO": 1,
  "sv-SE": 1,
  "fi-FI": 1,
} as const satisfies Record<SupportedLocale, Weekday>;

/** A calendar date from a year, a zero-based month and a day, which `Date.UTC` normalizes. */
function utcDate(year: number, month: number, day: number): IsoDate {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

/** A date's year, zero-based month and day. */
function partsOf(date: IsoDate): readonly [year: number, month: number, day: number] {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return [year, month - 1, day];
}

/** An ISO date moved by whole days, negative to go back. */
function addDays(date: IsoDate, days: number): IsoDate {
  const [year, month, day] = partsOf(date);
  return utcDate(year, month, day + days);
}

/** The seven days of the week that holds a date, from the locale's first day. */
function weekOf(date: IsoDate, locale: SupportedLocale): readonly [IsoDate, IsoDate] {
  const [year, month, day] = partsOf(date);
  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
  const first = addDays(date, -((weekday - WEEK_STARTS[locale] + 7) % 7));
  return [first, addDays(first, 6)];
}

/** The first and last day of the month `offset` months from a date's month. */
function monthOf(date: IsoDate, offset: number): readonly [IsoDate, IsoDate] {
  const [year, month] = partsOf(date);
  // From the 1st, so a 31st never overflows into the month after. Day 0 of the next month is the
  // month's last day.
  return [utcDate(year, month + offset, 1), utcDate(year, month + offset + 1, 0)];
}

/** January 1 and December 31 of the year `offset` years from a date's year. */
function yearOf(date: IsoDate, offset: number): readonly [IsoDate, IsoDate] {
  const [year] = partsOf(date);
  return [utcDate(year + offset, 0, 1), utcDate(year + offset, 11, 31)];
}

/**
 * A preset's first and last day. A period, such as This month, covers the whole period, days after
 * today included. Last 7 days and Last 30 days end today.
 *
 * @param key - The preset.
 * @param today - Today's calendar date in the Root's time zone.
 * @param locale - The Root's locale. Weeks start on Sunday in en-US and on Monday in nb-NO, sv-SE
 *   and fi-FI.
 * @returns The range, first day first.
 */
export function datePresetRange(
  key: DatePresetKey,
  today: IsoDate,
  locale: SupportedLocale
): readonly [IsoDate, IsoDate] {
  switch (key) {
    case "today":
      return [today, today];
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return [yesterday, yesterday];
    }
    case "thisWeek":
      return weekOf(today, locale);
    case "lastWeek":
      return weekOf(addDays(today, -7), locale);
    case "last7Days":
      return [addDays(today, -6), today];
    case "last30Days":
      return [addDays(today, -29), today];
    case "thisMonth":
      return monthOf(today, 0);
    case "lastMonth":
      return monthOf(today, -1);
    case "thisYear":
      return yearOf(today, 0);
    case "lastYear":
      return yearOf(today, -1);
  }
}

/**
 * Whether a preset names one day, so a field without `isBetween` can still write it as `is`. It
 * reads the key, never a range, so a period that happens to be one day long stays a period.
 *
 * @param key - The preset.
 * @returns Whether it is Today or Yesterday.
 */
export function isOneDayPreset(key: DatePresetKey): boolean {
  return key === "today" || key === "yesterday";
}
