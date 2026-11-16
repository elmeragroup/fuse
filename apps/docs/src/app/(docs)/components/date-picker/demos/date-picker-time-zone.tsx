"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerTimeZone() {
  return (
    <DatePickerField
      label="Outage starts"
      defaultValue={Temporal.ZonedDateTime.from("2026-10-24T22:00[Europe/Oslo]")}
    />
  );
}
