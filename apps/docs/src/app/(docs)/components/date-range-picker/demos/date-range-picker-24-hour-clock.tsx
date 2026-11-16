"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePicker24HourClock() {
  return (
    <DateRangePickerField
      label="Maintenance window"
      hourCycle={24}
      defaultValue={{
        start: Temporal.PlainDateTime.from("2026-10-05T08:00"),
        end: Temporal.PlainDateTime.from("2026-10-09T16:00"),
      }}
    />
  );
}
