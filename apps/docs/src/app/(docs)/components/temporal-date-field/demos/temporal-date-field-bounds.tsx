"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

/** Saturdays and Sundays, which the field reports as unavailable. */
function isWeekend(date: Temporal.PlainDate): boolean {
  return date.dayOfWeek >= 6;
}

export function TemporalDateFieldBounds() {
  return (
    <div className="max-w-xs flex w-full flex-col gap-4">
      <DateField<Temporal.PlainDate>
        label="Installation date"
        description="A weekday in July 2026."
        minValue="2026-07-01"
        maxValue="2026-07-31"
        isDateUnavailable={isWeekend}
        defaultValue="2026-08-03"
      />
      <DateField<Temporal.PlainDate>
        label="Start-up date"
        maxValue="2026-07-31"
        errorMessage="Pick a date in July."
        defaultValue="2026-07-14"
      />
    </div>
  );
}
