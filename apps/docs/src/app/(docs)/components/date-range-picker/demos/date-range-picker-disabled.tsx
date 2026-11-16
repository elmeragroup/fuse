"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerDisabled() {
  return (
    <DateRangePickerField
      label="Stay"
      isDisabled
      defaultValue={{
        start: Temporal.PlainDate.from("2026-10-05"),
        end: Temporal.PlainDate.from("2026-10-09"),
      }}
    />
  );
}
