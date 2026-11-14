"use client";

import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";

export function RangeCalendarResetOnLeave() {
  return (
    <RangeCalendar.Root
      aria-label="Stay"
      defaultValue={{
        start: Temporal.PlainDate.from("2026-10-12"),
        end: Temporal.PlainDate.from("2026-10-16"),
      }}
      commitBehavior="reset">
      <RangeCalendar.Header>
        <RangeCalendar.DecrementMonth />
        <RangeCalendar.VisibleRangeHeading />
        <RangeCalendar.IncrementMonth />
      </RangeCalendar.Header>
      <RangeCalendar.Months />
    </RangeCalendar.Root>
  );
}
