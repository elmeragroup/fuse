"use client";

import { Calendar } from "@elmeragroup/fuse/calendar";

export function CalendarBounds() {
  return (
    <Calendar.Root
      aria-label="Installation date"
      defaultValue={Temporal.PlainDate.from("2026-07-14")}
      minValue={Temporal.PlainDate.from("2026-07-06")}
      maxValue={Temporal.PlainDate.from("2026-07-31")}>
      <Calendar.Header>
        <Calendar.DecrementMonth />
        <Calendar.VisibleRangeHeading />
        <Calendar.IncrementMonth />
      </Calendar.Header>
      <Calendar.Months />
    </Calendar.Root>
  );
}
