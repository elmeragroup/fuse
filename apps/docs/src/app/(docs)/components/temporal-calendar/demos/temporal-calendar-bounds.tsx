"use client";

import { Calendar } from "@elmeragroup/fuse/calendar";

/** Saturdays and Sundays: focusable, so a keyboard user reads them, but never selectable. */
function isWeekend(date: Temporal.PlainDate): boolean {
  return date.dayOfWeek >= 6;
}

export function TemporalCalendarBounds() {
  return (
    <Calendar.Root
      aria-label="Installation date"
      defaultValue={Temporal.PlainDate.from("2026-07-14")}
      minValue={Temporal.PlainDate.from("2026-07-06")}
      maxValue={Temporal.PlainDate.from("2026-07-31")}
      isDateUnavailable={isWeekend}>
      <Calendar.Header>
        <Calendar.DecrementMonth />
        <Calendar.VisibleRangeHeading />
        <Calendar.IncrementMonth />
      </Calendar.Header>
      <Calendar.Months />
    </Calendar.Root>
  );
}
