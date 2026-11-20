/**
 * The days the calendar day set's renderer shows, free of imports for the compare page, which
 * `calendar-day-kit.ts` draws and `compare/calendar-day-cell.ts` renders. Every in-month cell shows
 * a 10th, so the `Day` property's default is the number each cell shows.
 */

/** The day each in-month cell shows mid-week: a Tuesday, its number behind the set's `Day` property. */
export const CALENDAR_DAY = "2026-11-10";

/** A day of the same month that holds the value where the cell shows no selection. */
export const CALENDAR_DAY_ELSEWHERE = "2026-11-15";

/** The first day a disabled cell's calendar allows, after the cell's day. */
export const CALENDAR_DAY_MINIMUM = "2026-11-12";

/** A 10th on the first day of an en-US week, a Sunday. */
const WEEK_START_DAY = "2027-01-10";

/** A 10th on the last day of an en-US week, a Saturday. */
const WEEK_END_DAY = "2026-10-10";

/** A range a range cell sits in, and the day the cell shows in it. */
type RangeSample = { readonly day: string; readonly start: string; readonly end: string };

/**
 * The range a range cell sits in, by where the cell's day sits in it: mid-week for `start`, `middle`
 * and `end`, and on the week's first or last day for the rest.
 */
export const CALENDAR_RANGES = {
  start: { day: CALENDAR_DAY, start: "2026-11-10", end: "2026-11-12" },
  middle: { day: CALENDAR_DAY, start: "2026-11-09", end: "2026-11-11" },
  end: { day: CALENDAR_DAY, start: "2026-11-08", end: "2026-11-10" },
  "start-week-end": { day: WEEK_END_DAY, start: "2026-10-10", end: "2026-10-12" },
  "middle-week-start": { day: WEEK_START_DAY, start: "2027-01-09", end: "2027-01-11" },
  "middle-week-end": { day: WEEK_END_DAY, start: "2026-10-09", end: "2026-10-11" },
  "end-week-start": { day: WEEK_START_DAY, start: "2027-01-08", end: "2027-01-10" },
} as const satisfies Record<string, RangeSample>;

/** The day an outside cell shows: November 30, in December's first week. */
export const CALENDAR_OUTSIDE_DAY = "2026-11-30";

/** A day of December that holds the value where the cell shows an outside day. */
export const CALENDAR_OUTSIDE_VALUE = "2026-12-15";
