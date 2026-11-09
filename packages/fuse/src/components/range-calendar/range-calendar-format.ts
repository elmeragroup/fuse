// The words RangeCalendar names its range's ends with, as React Aria's `useSelectedDateDescription`
// writes them: "Selected Range: Monday, October 5 to Friday, October 9, 2026" for a range, and
// "Selected Date: Tuesday, October 20, 2026" for a one-day range.

import type { LocalizedStringDictionary, LocalizedStringFormatter } from "@internationalized/string";

import { formatDayName, formatDayNameWithoutYear } from "../calendar/calendar-format";
import type { rangeCalendarStrings } from "./intl";
import type { DayRange } from "./range-selection";

/** RangeCalendar's string formatter for one locale. */
export type RangeCalendarStrings =
  typeof rangeCalendarStrings extends LocalizedStringDictionary<infer K, infer T>
    ? LocalizedStringFormatter<K, T>
    : never;

/**
 * The description of a selected range.
 *
 * @param locale - The locale the dates are written in.
 * @param strings - RangeCalendar's strings in that locale.
 * @param range - The range.
 * @returns The description.
 */
export function selectedRangeDescription(
  locale: string,
  strings: RangeCalendarStrings,
  range: DayRange
): string {
  if (range.start.equals(range.end)) {
    return strings.format("selectedDateDescription", { date: formatDayName(locale, range.start) });
  }
  // The start leaves out a year the end already writes.
  const startDate =
    range.start.year === range.end.year
      ? formatDayNameWithoutYear(locale, range.start)
      : formatDayName(locale, range.start);
  const dateRange = strings.format("dateRange", { startDate, endDate: formatDayName(locale, range.end) });
  return strings.format("selectedRangeDescription", { dateRange });
}
