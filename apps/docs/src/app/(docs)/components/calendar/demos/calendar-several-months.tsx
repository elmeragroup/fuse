"use client";

import { Calendar } from "@elmeragroup/fuse/calendar";

export function CalendarSeveralMonths() {
  return (
    <Calendar.Root
      aria-label="Check-in"
      defaultValue={Temporal.PlainDate.from("2026-10-14")}
      visibleMonths={2}>
      <Calendar.Header>
        <Calendar.DecrementMonth />
        <Calendar.VisibleRangeHeading />
        <Calendar.IncrementMonth />
      </Calendar.Header>
      <Calendar.Months />
    </Calendar.Root>
  );
}
