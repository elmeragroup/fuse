"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerWithoutLeadingZeros() {
  return (
    <DateRangePickerField
      label="Stay"
      shouldForceLeadingZeros={false}
      defaultValue={{
        start: Temporal.PlainDate.from("2026-10-05"),
        end: Temporal.PlainDate.from("2026-10-09"),
      }}
    />
  );
}
