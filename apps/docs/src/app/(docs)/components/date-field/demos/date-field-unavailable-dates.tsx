"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

/** Saturdays and Sundays, which the field reports as unavailable. */
function isWeekend(date: Temporal.PlainDate): boolean {
  return date.dayOfWeek >= 6;
}

export function DateFieldUnavailableDates() {
  // The field shows its own error only after a blur, so `isInvalid` marks the Saturday from the start.
  return (
    <DateField
      label="Installation date"
      isDateUnavailable={isWeekend}
      defaultValue={Temporal.PlainDate.from("2026-07-18")}
      isInvalid
      errorMessage="Installations run on weekdays only."
    />
  );
}
