/**
 * The renderer of the `calendar-day` set: one real `Calendar.DayGridCell` around its
 * `Calendar.DayButton`, in its week's `Calendar.DayGridRow` of a Calendar or, for a range cell, a
 * RangeCalendar. The row holds the other six days as plain empty cells, so the day keeps its place
 * in the week, as `:first-child` and `:last-child` read it, and is the only element of its slot the
 * page measures. Each cell sets its state through the root's props:
 *
 * - none: a Calendar whose value is another day of the month; selected: a Calendar whose value is
 *   the day; a range's day: a RangeCalendar whose range the day starts, sits in or ends, on a
 *   Tuesday, or on a Sunday or a Saturday where the cell sits at the week's edge;
 * - disabled: a Calendar whose `minValue` comes after the day; outside: a December Calendar showing
 *   30 November in its first week; unavailable: a calendar whose `isDateUnavailable` refuses the day,
 *   and for a range's middle day the range's end too. RangeCalendar checks only a range's ends, so
 *   it shows an unavailable day inside a valid range as outside the range, as `selection` none draws
 *   it, and every day of a range with a refused end as invalid (`rangeDayFlags`).
 *
 * Calendar marks today from the clock in a layout effect, which a static render never runs, so a
 * today cell's button takes the `data-current` attribute Calendar writes on today's button, as the
 * page writes Base UI's `data-highlighted` on a highlighted row.
 *
 * The calendar around the day takes consumer classes that strip its card, so the crop shows only the
 * day. The cells render in an en-US `LocaleProvider`, whose weeks start on Sunday. Node cannot load Fuse's
 * TSX source, so this module imports the Fuse build; `cell-renderers.ts` imports it only after the
 * run found the build.
 */

import { createElement } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

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

/**
 * The week of `target` in a month grid, the target day as a real cell and the others as plain ones.
 * `today` marks the target's button as Calendar marks today's.
 */
function weekOf(parts: GridParts, target: Temporal.PlainDate, today: boolean): ReactNode {
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
                            createElement(parts.DayButton, dayButton(today))
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

/** A day button's props: on today, the attribute Calendar writes on today's button. */
function dayButton(today: boolean): ComponentProps<typeof Calendar.DayButton> & { "data-current"?: "" } {
  const props: ComponentProps<typeof Calendar.DayButton> & { "data-current"?: "" } = {};
  if (today) {
    props["data-current"] = "";
  }
  return props;
}

/** The cell's calendar, holding its one day. */
function dayIn(cell: Cell): ReactElement {
  const today = cell.today === "true";
  const range = cell.selection === undefined ? undefined : RANGES.get(cell.selection);
  const target = date(cell.outside === "true" ? CALENDAR_OUTSIDE_DAY : (range?.day ?? CALENDAR_DAY));
  // An unavailable cell's calendar refuses the day, which it still lets the user reach. RangeCalendar
  // shows an unavailable day between a range's ends only where an end is refused too, so a middle
  // cell's calendar refuses the range's end as well.
  const refused =
    range !== undefined && cell.selection?.startsWith("middle") === true
      ? [target, date(range.end)]
      : [target];
  const unavailable =
    cell.state === "unavailable"
      ? { isDateUnavailable: (day: Temporal.PlainDate) => refused.some((each) => day.equals(each)) }
      : {};
  if (range !== undefined) {
    return createElement(
      RangeCalendar.Root,
      {
        "aria-label": "Stay",
        className: BARE,
        defaultValue: { start: date(range.start), end: date(range.end) },
        ...unavailable,
      },
      weekOf(RangeCalendar, target, today)
    );
  }
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
    ...unavailable,
  };
  // A disabled in-month day sits before the first day its calendar allows.
  const bounded =
    cell.state === "disabled" && cell.outside !== "true"
      ? { ...root, minValue: date(CALENDAR_DAY_MINIMUM) }
      : root;
  return createElement(Calendar.Root, bounded, weekOf(Calendar, target, today));
}

/** The range each range cell's day sits in, by its `selection`. */
const RANGES = new Map(Object.entries(CALENDAR_RANGES));

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
