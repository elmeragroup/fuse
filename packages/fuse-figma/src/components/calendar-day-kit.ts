/**
 * The calendar day, as one component set on the Calendar page (#677): one day of the month grid
 * that Calendar and RangeCalendar share, its cell and its button, 17 cells.
 *
 * - The root is `Calendar.DayGridCell`'s `<td data-slot="calendar-day-grid-cell">`, which paints a
 *   range's band and rounds its ends.
 * - The button is `Calendar.DayButton`'s `<button data-slot="calendar-day-button">`, holding the
 *   day's number behind the `Day` TEXT property.
 * - `selection` is where the day sits in the selection: none, the one selected day of a Calendar, or
 *   the start, a middle day or the end of a RangeCalendar's range. `state` is rest, hover, focus or
 *   disabled, and `outside` a day of a neighboring month, whose button the grid hides.
 *
 * Each in-month cell shows Tuesday 10 November 2026, so every cell sits mid-week, where a range's
 * middle day rounds no corner of its own. An outside cell shows 30 November in December's grid; its
 * button is hidden, so the number it holds draws nothing and the set keeps `10`. The set draws no
 * day marked as today, which Calendar marks from the clock in an effect, no unavailable day, and no
 * range day at a week's start or end.
 */
import type { PartManifest, SetManifest } from "../capture/manifest";
import { always } from "./popup-facts";

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
    { name: "selection", values: ["none", "selected", "start", "middle", "end"] },
    { name: "outside", values: ["false", "true"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  ],
  impossible: [
    {
      where: { state: "disabled", selection: "selected" },
      fact: "Calendar's `dayStatus` and `Calendar.DayGridCell` give a disabled day no selection flags (`calendar-parts.tsx`), so it never shows as selected.",
    },
    ...(["start", "middle", "end"] as const).map((selection) => ({
      where: { state: "disabled", selection },
      fact: "Calendar's `dayStatus` and `Calendar.DayGridCell` give a disabled day no selection flags (`calendar-parts.tsx`), so it is never part of a range.",
    })),
    ...(["selected", "start", "middle", "end"] as const).map((selection) => ({
      where: { outside: "true", selection },
      fact: "Calendar's `dayStatus` disables every day of a neighboring month, and a disabled day holds no selection flags (`calendar-parts.tsx`).",
    })),
    ...(["rest", "hover", "focus"] as const).map((state) => ({
      where: { outside: "true", state },
      fact: "Calendar's `dayStatus` disables every day of a neighboring month (`calendar-dates.ts`), so its button is always disabled.",
    })),
  ],
  columnAxis: "state",
  statePart: "calendar-day-button",
  label: undefined,
  iconsFor: () => [],
  parts: [BUTTON],
  swapProperties: [],
};
