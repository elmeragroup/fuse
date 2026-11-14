"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerHiddenTimeZone() {
  return (
    <DateRangePickerField
      label="Outage"
      hideTimeZone
      defaultValue={{
        start: Temporal.ZonedDateTime.from("2026-10-24T22:00[Europe/Oslo]"),
        end: Temporal.ZonedDateTime.from("2026-10-25T06:00[Europe/Oslo]"),
      }}
    />
  );
}
