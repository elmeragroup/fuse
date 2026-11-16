"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerError() {
  return (
    <DatePickerField
      label="Moving date"
      isInvalid
      errorMessage="Choose a date after the lease ends."
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
    />
  );
}
