"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

/** Saturdays and Sundays, which the field reports as unavailable. */
function isWeekend(date: Temporal.PlainDate): boolean {
  return date.dayOfWeek >= 6;
}

export function DateFieldBounds() {
  return (
    <div className="max-w-xs flex w-full flex-col gap-4">
      <DateField
        label="Installation date"
        description="A weekday in July 2026."
        minValue={Temporal.PlainDate.from("2026-07-01")}
        maxValue={Temporal.PlainDate.from("2026-07-31")}
        isDateUnavailable={isWeekend}
        defaultValue={Temporal.PlainDate.from("2026-08-03")}
      />
      <DateField
        label="Start-up date"
        maxValue={Temporal.PlainDate.from("2026-07-31")}
        errorMessage="Pick a date in July."
        defaultValue={Temporal.PlainDate.from("2026-07-14")}
      />
    </div>
  );
}
