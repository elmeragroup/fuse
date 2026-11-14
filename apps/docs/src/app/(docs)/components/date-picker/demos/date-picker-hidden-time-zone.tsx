"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerHiddenTimeZone() {
  return (
    <DatePickerField
      label="Outage starts"
      hideTimeZone
      defaultValue={Temporal.ZonedDateTime.from("2026-10-24T22:00[Europe/Oslo]")}
    />
  );
}
