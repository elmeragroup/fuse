"use client";

import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";

export function RangeCalendarBounds() {
  return (
    <RangeCalendar.Root
      aria-label="Cabin stay"
      defaultValue={{
        start: Temporal.PlainDate.from("2026-10-13"),
        end: Temporal.PlainDate.from("2026-10-15"),
      }}
      minValue={Temporal.PlainDate.from("2026-10-05")}
      maxValue={Temporal.PlainDate.from("2026-11-15")}>
      <RangeCalendar.Header>
        <RangeCalendar.DecrementMonth />
        <RangeCalendar.VisibleRangeHeading />
        <RangeCalendar.IncrementMonth />
      </RangeCalendar.Header>
      <RangeCalendar.Months />
    </RangeCalendar.Root>
  );
}
