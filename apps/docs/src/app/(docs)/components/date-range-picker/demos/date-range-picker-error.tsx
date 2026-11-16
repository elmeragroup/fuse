"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerError() {
  return (
    <DateRangePickerField
      label="Stay"
      isInvalid
      errorMessage="The cabin is booked on these nights."
      defaultValue={{
        start: Temporal.PlainDate.from("2026-10-05"),
        end: Temporal.PlainDate.from("2026-10-09"),
      }}
    />
  );
}
