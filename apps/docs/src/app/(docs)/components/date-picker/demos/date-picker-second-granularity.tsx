"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerSecondGranularity() {
  return (
    <DatePickerField
      label="Delivery window starts"
      granularity="second"
      defaultValue={Temporal.PlainDateTime.from("2026-10-05T08:30")}
    />
  );
}
