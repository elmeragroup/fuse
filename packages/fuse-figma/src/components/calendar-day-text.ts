/**
 * The days the calendar day set's renderer shows, free of imports for the compare page, which
 * `calendar-day-kit.ts` draws and `compare/calendar-day-cell.ts` renders. Every in-month cell shows
 * Tuesday 10 November 2026, so the `Day` property's default is the number each cell shows.
 */

/** The day each in-month cell shows: a Tuesday, its number behind the set's `Day` property. */
export const CALENDAR_DAY = "2026-11-10";

/** A day of the same month that holds the value where the cell shows no selection. */
export const CALENDAR_DAY_ELSEWHERE = "2026-11-15";

/** The first day a disabled cell's calendar allows, after the cell's day. */
export const CALENDAR_DAY_MINIMUM = "2026-11-12";

/** The range a range cell sits in, by where the cell's day sits in it. */
export const CALENDAR_RANGES = {
  start: { start: "2026-11-10", end: "2026-11-12" },
  middle: { start: "2026-11-09", end: "2026-11-11" },
  end: { start: "2026-11-08", end: "2026-11-10" },
} as const;

/** The day an outside cell shows: November 30, in December's first week. */
export const CALENDAR_OUTSIDE_DAY = "2026-11-30";

/** A day of December that holds the value where the cell shows an outside day. */
export const CALENDAR_OUTSIDE_VALUE = "2026-12-15";
