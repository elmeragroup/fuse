"use client";

import { Calendar } from "@elmeragroup/fuse/calendar";

export function CalendarWeekStartsMonday() {
  return (
    <Calendar.Root
      aria-label="Delivery date"
      defaultValue={Temporal.PlainDate.from("2026-10-14")}
      firstDayOfWeek="mon">
      <Calendar.Header>
        <Calendar.DecrementMonth />
        <Calendar.VisibleRangeHeading />
        <Calendar.IncrementMonth />
      </Calendar.Header>
      <Calendar.Months />
    </Calendar.Root>
  );
}
