"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePicker24HourClock() {
  return (
    <DatePickerField
      label="Delivery window starts"
      hourCycle={24}
      defaultValue={Temporal.PlainDateTime.from("2026-10-05T08:30")}
    />
  );
}
