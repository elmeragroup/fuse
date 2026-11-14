"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerDateAndTime() {
  return (
    <DatePickerField
      label="Delivery window starts"
      defaultValue={Temporal.PlainDateTime.from("2026-10-05T08:30")}
    />
  );
}
