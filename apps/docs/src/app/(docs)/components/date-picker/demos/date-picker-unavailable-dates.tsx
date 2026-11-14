"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

/** Saturdays and Sundays, which the picker refuses. */
function isWeekend(date: Temporal.PlainDate): boolean {
  return date.dayOfWeek >= 6;
}

export function DatePickerUnavailableDates() {
  return (
    <DatePickerField
      label="Installation date"
      description="A weekday."
      isDateUnavailable={isWeekend}
      defaultValue={Temporal.PlainDate.from("2026-10-14")}
    />
  );
}
