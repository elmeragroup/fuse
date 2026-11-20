/**
 * Calendar and RangeCalendar, each as one component set (#677): the docs default demo in its card,
 * 1 cell each.
 *
 * - The root is `Calendar.Root`'s `<div data-slot="calendar">`, or RangeCalendar's
 *   `<div data-slot="range-calendar">`, around `Calendar.Header` and `Calendar.Months`.
 * - The header holds the month buttons, ghost `icon` Icon button instances with CaretLeft and
 *   CaretRight, around the visible-range heading, whose text is behind the `Heading` TEXT property.
 * - `Calendar.Months` holds its one `Calendar.Month` and that month's day grid: the weekday row over
 *   October 2026's five weeks, from Sunday 27 September.
 * - Each weekday's name is behind a TEXT property, `Weekday 1` for Sunday to `Weekday 7`.
 * - Each day is an instance of the calendar day set in the cell its day shows: September's days are
 *   outside the month, and the Calendar's 14 October is selected, or the RangeCalendar's 12 to 16
 *   October form its range. The instance's `Day` property holds the day's number.
 * - The month's heading is visually hidden in a calendar of one month, so the sets leave it out.
 */
import type { InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import { ICON_BUTTON_MANIFEST } from "./button-kit";
import { CALENDAR_DAY_MANIFEST } from "./calendar-day-kit";
import { always } from "./popup-facts";

/** One day of the grid: its number and where it sits in the selection. */
type DaySample = {
  readonly number: string;
  readonly selection: string;
  readonly outside: boolean;
};

/** The weekday names an en-US grid shows, from Sunday. */
const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** The days of September an en-US grid of October 2026 shows before 1 October, a Thursday. */
const SEPTEMBER_DAYS = 4;

/** The weeks an en-US grid of October 2026 shows, the last ending on 31 October, a Saturday. */
const OCTOBER_WEEKS = 5;

/** October 2026's weeks from Sunday 27 September, each day's selection given by `selectionOf`. */
function october(selectionOf: (day: number) => string): readonly (readonly DaySample[])[] {
  return Array.from({ length: OCTOBER_WEEKS }, (_, week) =>
    CALENDAR_WEEKDAYS.map((_name, column): DaySample => {
      const day = week * CALENDAR_WEEKDAYS.length + column - SEPTEMBER_DAYS + 1;
      return day < 1
        ? { number: String(30 + day), selection: "none", outside: true }
        : { number: String(day), selection: selectionOf(day), outside: false };
    })
  );
}

/** The day the Calendar demo selects, in October 2026. */
export const CALENDAR_SELECTED = 14;

/** The days the RangeCalendar demo's range starts and ends on, in October 2026. */
export const RANGE_CALENDAR_RANGE = { start: 12, end: 16 } as const;

/** A part by its `data-slot`, holding no text of its own. */
function frame(key: string, slot: string, parts: readonly (PartManifest | InstanceManifest)[]): PartManifest {
  return { key, slot, shownIn: always, label: undefined, iconsFor: () => [], parts };
}

/** A day of the grid: an instance of the calendar day set. */
function day(sample: DaySample, column: number): InstanceManifest {
  return {
    kind: "instance",
    key: `day-${String(column + 1)}`,
    of: CALENDAR_DAY_MANIFEST,
    cell: () => ({
      selection: sample.selection,
      outside: String(sample.outside),
      state: sample.outside ? "disabled" : "rest",
      today: "false",
    }),
    properties: () => ({ text: { Day: sample.number } }),
    shownIn: always,
  };
}

/** A weekday's header cell, holding its name. */
function weekday(name: string, column: number): PartManifest {
  return {
    key: `weekday-${String(column + 1)}`,
    slot: "calendar-day-grid-header-cell",
    shownIn: always,
    label: {
      key: "label",
      name: "label",
      characters: name,
      textProperty: `Weekday ${String(column + 1)}`,
      shownIn: always,
    },
    iconsFor: () => [],
  };
}

/**
 * The month both demos open on, as the en-US visible-range heading names it: `Intl.DateTimeFormat`
 * joins the month and year with a no-break space.
 */
export const CALENDAR_HEADING = "October\u00A02026";

/** A month button: a ghost `icon` Icon button with its caret. */
function monthButton(key: string, slot: string, icon: string): InstanceManifest {
  return {
    kind: "instance",
    key,
    of: ICON_BUTTON_MANIFEST,
    slot,
    cell: () => ({ variant: "ghost", size: "icon", state: "rest" }),
    properties: () => ({ swap: { Icon: icon } }),
    shownIn: always,
  };
}

/** The header: the month buttons around the visible-range heading. */
const HEADER: PartManifest = frame("header", "calendar-header", [
  monthButton("previous", "calendar-decrement-month", "CaretLeft"),
  {
    key: "heading",
    slot: "calendar-visible-range-heading",
    shownIn: always,
    label: {
      key: "label",
      name: "label",
      characters: CALENDAR_HEADING,
      textProperty: "Heading",
      shownIn: always,
    },
    iconsFor: () => [],
  },
  monthButton("next", "calendar-increment-month", "CaretRight"),
]);

/** The parts of a calendar of one month: its header, its months, its month and the month's day grid. */
function monthParts(weeks: readonly (readonly DaySample[])[]): readonly PartManifest[] {
  return [
    HEADER,
    frame("months", "calendar-months", [
      frame("month", "calendar-month", [
        frame("grid", "calendar-day-grid", [
          frame("grid-header", "calendar-day-grid-header", [
            frame("weekdays", "calendar-day-grid-header-row", CALENDAR_WEEKDAYS.map(weekday)),
          ]),
          frame(
            "grid-body",
            "calendar-day-grid-body",
            weeks.map((week, row) => frame(`week-${String(row + 1)}`, "calendar-day-grid-row", week.map(day)))
          ),
        ]),
      ]),
    ]),
  ];
}

/** Calendar's manifest, which the capture-backed build reads with `captures/calendar.json`. */
export const CALENDAR_MANIFEST: SetManifest = {
  key: "calendar",
  name: "Calendar",
  api: { page: "calendar", parts: ["Calendar.Root"] },
  slot: "calendar",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: monthParts(october((date) => (date === CALENDAR_SELECTED ? "selected" : "none"))),
  swapProperties: [],
};

/** Where a day of October 2026 sits in the RangeCalendar demo's range. */
function inRange(date: number): string {
  if (date === RANGE_CALENDAR_RANGE.start) {
    return "start";
  }
  if (date === RANGE_CALENDAR_RANGE.end) {
    return "end";
  }
  return date > RANGE_CALENDAR_RANGE.start && date < RANGE_CALENDAR_RANGE.end ? "middle" : "none";
}

/** RangeCalendar's manifest, which the capture-backed build reads with `captures/range-calendar.json`. */
export const RANGE_CALENDAR_MANIFEST: SetManifest = {
  key: "range-calendar",
  name: "Range calendar",
  api: { page: "range-calendar", parts: ["RangeCalendar.Root"] },
  slot: "range-calendar",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: monthParts(october(inRange)),
  swapProperties: [],
};
