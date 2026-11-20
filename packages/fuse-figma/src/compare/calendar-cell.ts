/**
 * The renderers of the `calendar` and `range-calendar` sets: the docs default demos, Calendar with
 * 14 October 2026 selected and RangeCalendar with 12 to 16 October, each in an en-US
 * `LocaleProvider`, whose weeks start on Sunday. Each renders the demo's header, its month buttons
 * around the visible-range heading, over `Calendar.Months`.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Calendar } from "../../../fuse/dist/calendar.js";
import { RangeCalendar } from "../../../fuse/dist/range-calendar.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import { CALENDAR_SELECTED, RANGE_CALENDAR_RANGE } from "../components/calendar-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A day of October 2026, the month both demos open on. */
const october = (day: number) => Temporal.PlainDate.from({ year: 2026, month: 10, day });

/** The `calendar` cell: the Calendar default demo's month. */
export const calendar: CellRendering = {
  element: () =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(
        Calendar.Root,
        { "aria-label": "Delivery date", defaultValue: october(CALENDAR_SELECTED) },
        createElement(
          Calendar.Header,
          null,
          createElement(Calendar.DecrementMonth),
          createElement(Calendar.VisibleRangeHeading),
          createElement(Calendar.IncrementMonth)
        ),
        createElement(Calendar.Months)
      ),
    }),
};

/** The `range-calendar` cell: the RangeCalendar default demo's month. */
export const rangeCalendar: CellRendering = {
  element: () =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(
        RangeCalendar.Root,
        {
          "aria-label": "Stay",
          defaultValue: {
            start: october(RANGE_CALENDAR_RANGE.start),
            end: october(RANGE_CALENDAR_RANGE.end),
          },
        },
        createElement(
          RangeCalendar.Header,
          null,
          createElement(RangeCalendar.DecrementMonth),
          createElement(RangeCalendar.VisibleRangeHeading),
          createElement(RangeCalendar.IncrementMonth)
        ),
        createElement(RangeCalendar.Months)
      ),
    }),
};
