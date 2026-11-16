"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerSeveralMonths() {
  return (
    <DateRangePickerField
      label="Campaign"
      visibleMonths={2}
      defaultValue={{
        start: Temporal.PlainDate.from("2026-10-26"),
        end: Temporal.PlainDate.from("2026-11-06"),
      }}
    />
  );
}
