"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerHourGranularity() {
  return (
    <DatePickerField
      label="Delivery window starts"
      granularity="hour"
      defaultValue={Temporal.PlainDateTime.from("2026-10-05T08:30")}
    />
  );
}
