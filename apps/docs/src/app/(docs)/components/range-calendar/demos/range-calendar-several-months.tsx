"use client";

import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";

export function RangeCalendarSeveralMonths() {
  return (
    <RangeCalendar.Root
      aria-label="Billing period"
      defaultValue={{
        start: Temporal.PlainDate.from("2026-10-26"),
        end: Temporal.PlainDate.from("2026-11-06"),
      }}
      visibleMonths={2}>
      <RangeCalendar.Header>
        <RangeCalendar.DecrementMonth />
        <RangeCalendar.VisibleRangeHeading />
        <RangeCalendar.IncrementMonth />
      </RangeCalendar.Header>
      <RangeCalendar.Months />
    </RangeCalendar.Root>
  );
}
