/**
 * The renderer of the `calendar-day` set: one real `Calendar.DayGridCell` around its
 * `Calendar.DayButton`, in its week's `Calendar.DayGridRow` of a Calendar or, for a range cell, a
 * RangeCalendar. The row holds the other six days as plain empty cells, so the day keeps its place
 * in the week, as `:first-child` and `:last-child` read it, and is the only element of its slot the
 * page measures. Each cell sets its state through the root's props:
 *
 * - none: a Calendar whose value is another day of the month; selected: a Calendar whose value is
 *   the day; start, middle and end: a RangeCalendar whose range the day starts, sits in or ends;
 * - disabled: a Calendar whose `minValue` comes after the day; outside: a December Calendar showing
 *   30 November in its first week.
 *
 * The calendar around the day takes consumer classes that strip its card, so the crop shows only the
 * day. The cells render in an en-US `LocaleProvider`, whose weeks start on Sunday. Node cannot load Fuse's
 * TSX source, so this module imports the Fuse build; `cell-renderers.ts` imports it only after the
 * run found the build.
 */

import { createElement } from "react";
import type { ReactElement, ReactNode } from "react";

import { Calendar } from "../../../fuse/dist/calendar.js";
import { RangeCalendar } from "../../../fuse/dist/range-calendar.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import {
  CALENDAR_DAY,
  CALENDAR_DAY_ELSEWHERE,
  CALENDAR_DAY_MINIMUM,
  CALENDAR_OUTSIDE_DAY,
  CALENDAR_OUTSIDE_VALUE,
  CALENDAR_RANGES,
} from "../components/calendar-day-text.ts";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A date of the cells' samples. */
const date = (iso: string) => Temporal.PlainDate.from(iso);

/** The parts a Calendar and a RangeCalendar share, by the name each exports them under. */
type GridParts = Pick<
  typeof Calendar,
  "Months" | "Month" | "DayGrid" | "DayGridBody" | "DayGridRow" | "DayGridCell" | "DayButton"
>;

/** The week of `target` in a month grid, the target day as a real cell and the others as plain ones. */
function weekOf(parts: GridParts, target: Temporal.PlainDate): ReactNode {
  return createElement(parts.Months, {
    children: (month: Temporal.PlainYearMonth) =>
      createElement(
        parts.Month,
        { key: month.toString(), value: month },
        createElement(
          parts.DayGrid,
          null,
          createElement(parts.DayGridBody, {
            children: (week: Temporal.PlainDate) => {
              const days = Temporal.PlainDate.compare(target, week) >= 0 && week.until(target).days < 7;
              return days
                ? createElement(parts.DayGridRow, {
                    key: week.toString(),
                    value: week,
                    children: (day: Temporal.PlainDate) =>
                      day.equals(target)
                        ? createElement(
                            parts.DayGridCell,
                            { key: day.toString(), value: day },
                            createElement(parts.DayButton)
                          )
                        : createElement("td", { key: day.toString() }),
                  })
                : null;
            },
          })
        )
      ),
  });
}

/** The cell's calendar, holding its one day. */
function dayIn(cell: Cell): ReactElement {
  const target = date(cell.outside === "true" ? CALENDAR_OUTSIDE_DAY : CALENDAR_DAY);
  switch (cell.selection) {
    case "start":
    case "middle":
    case "end": {
      const range = CALENDAR_RANGES[cell.selection];
      return createElement(
        RangeCalendar.Root,
        {
          "aria-label": "Stay",
          className: BARE,
          defaultValue: { start: date(range.start), end: date(range.end) },
        },
        weekOf(RangeCalendar, target)
      );
    }
    default: {
      const root = {
        "aria-label": "Delivery date",
        className: BARE,
        defaultValue: date(
          cell.outside === "true"
            ? CALENDAR_OUTSIDE_VALUE
            : cell.selection === "selected"
              ? CALENDAR_DAY
              : CALENDAR_DAY_ELSEWHERE
        ),
      };
      // A disabled in-month day sits before the first day its calendar allows.
      const bounded =
        cell.state === "disabled" && cell.outside !== "true"
          ? { ...root, minValue: date(CALENDAR_DAY_MINIMUM) }
          : root;
      return createElement(Calendar.Root, bounded, weekOf(Calendar, target));
    }
  }
}

/**
 * The classes the cell's calendar takes, which strip its border, shadow, fill and padding, so the
 * crop around the day shows the page and no edge of the card around it. The set draws the day alone.
 */
const BARE = "border-0 bg-transparent shadow-none p-0";

/** A `calendar-day` cell: the day in its week's row, in English. */
export const calendarDay: CellRendering = {
  element: (cell: Cell) => createElement(LocaleProvider, { locale: "en-US", children: dayIn(cell) }),
  hostClasses: BARE.split(" "),
};
