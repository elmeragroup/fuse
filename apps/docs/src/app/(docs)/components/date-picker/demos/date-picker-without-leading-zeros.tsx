"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerWithoutLeadingZeros() {
  return (
    <DatePickerField
      label="Moving date"
      shouldForceLeadingZeros={false}
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
    />
  );
}
