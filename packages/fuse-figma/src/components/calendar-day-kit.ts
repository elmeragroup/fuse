/**
 * The calendar day, as one component set on the Calendar page (#677): one day of the month grid
 * that Calendar and RangeCalendar share, its cell and its button.
 *
 * - The root is `Calendar.DayGridCell`'s `<td data-slot="calendar-day-grid-cell">`, which paints a
 *   range's band and rounds its ends.
 * - The button is `Calendar.DayButton`'s `<button data-slot="calendar-day-button">`, holding the
 *   day's number behind the `Day` TEXT property.
 * - `selection` is where the day sits in the selection: none, the one selected day of a Calendar, or
 *   the start, a middle day or the end of a RangeCalendar's range, mid-week or on the week's first or
 *   last day, where the row rounds the range's band. `state` is rest, hover, focus, disabled or
 *   unavailable, `outside` a day of a neighboring month, whose button the grid hides, and `today`
 *   the day Calendar marks as today.
 *
 * Each in-month cell shows a 10th: a Tuesday mid-week, a Sunday at a week's start or a Saturday at
 * its end. An outside cell shows 30 November in December's grid; its button is hidden, so the
 * number it holds draws nothing and the set keeps `10`. A range's start on the week's first day and
 * its end on the week's last day draw as a start and an end mid-week, and a range of one day draws
 * as a start on the week's last day.
 */
import type { PartManifest, SetManifest } from "../capture/manifest";
import { always } from "./popup-facts";

/** The places in a range a range cell's day takes, mid-week and at a week's edge. */
const RANGE_SELECTIONS = [
  "start",
  "middle",
  "end",
  "start-week-end",
  "middle-week-start",
  "middle-week-end",
  "end-week-start",
] as const;

/** Every value of the `selection` axis: no selection, Calendar's one selected day, or a range's day. */
const SELECTIONS = ["none", "selected", ...RANGE_SELECTIONS] as const;

/** The number every cell's button shows, the `Day` property's default. */
export const CALENDAR_DAY_NUMBER = "10";

/** The day's button, which holds its number. */
const BUTTON: PartManifest = {
  key: "button",
  slot: "calendar-day-button",
  shownIn: always,
  label: {
    key: "label",
    name: "label",
    characters: CALENDAR_DAY_NUMBER,
    textProperty: "Day",
    shownIn: always,
  },
  iconsFor: () => [],
};

/**
 * The calendar day's manifest, which the capture-backed build reads with
 * `captures/calendar-day.json`: one `Calendar.DayGridCell` around its `Calendar.DayButton`, in its
 * week's row of a Calendar or a RangeCalendar.
 */
export const CALENDAR_DAY_MANIFEST: SetManifest = {
  key: "calendar-day",
  name: "Calendar day",
  api: { page: "calendar", parts: ["Calendar.DayGridCell"] },
  slot: "calendar-day-grid-cell",
  axes: [
    { name: "selection", values: [...SELECTIONS] },
    { name: "outside", values: ["false", "true"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled", "unavailable"] },
    { name: "today", values: ["false", "true"] },
  ],
  // The today axis came after the set's first release, so a day that is not today keeps the key it
  // had then (W5-P2).
  addedAxes: new Set(["today"]),
  impossible: [
    {
      where: { state: "disabled", selection: "selected" },
      fact: "Calendar's `dayStatus` and `Calendar.DayGridCell` give a disabled day no selection flags (`calendar-parts.tsx`), so it never shows as selected.",
    },
    ...RANGE_SELECTIONS.map((selection) => ({
      where: { state: "disabled", selection },
      fact: "Calendar's `dayStatus` and `Calendar.DayGridCell` give a disabled day no selection flags (`calendar-parts.tsx`), so it is never part of a range.",
    })),
    ...(["selected", ...RANGE_SELECTIONS] as const).map((selection) => ({
      where: { outside: "true", selection },
      fact: "Calendar's `dayStatus` disables every day of a neighboring month, and a disabled day holds no selection flags (`calendar-parts.tsx`).",
    })),
    ...(["rest", "hover", "focus", "unavailable"] as const).map((state) => ({
      where: { outside: "true", state },
      fact: "Calendar's `dayStatus` disables every day of a neighboring month and marks none unavailable (`calendar-dates.ts`), so its button is always disabled.",
    })),
  ],
  columnAxis: "state",
  statePart: "calendar-day-button",
  label: undefined,
  iconsFor: () => [],
  parts: [BUTTON],
  swapProperties: [],
};
