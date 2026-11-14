"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerSecondGranularity() {
  return (
    <DateRangePickerField
      label="Maintenance window"
      granularity="second"
      defaultValue={{
        start: Temporal.PlainDateTime.from("2026-10-05T08:00"),
        end: Temporal.PlainDateTime.from("2026-10-09T16:00"),
      }}
    />
  );
}
