"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerDemo() {
  return (
    <DatePickerField
      label="Moving date"
      description="Type it or pick it from the calendar."
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
    />
  );
}
