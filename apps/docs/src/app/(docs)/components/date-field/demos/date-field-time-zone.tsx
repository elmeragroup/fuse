"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldTimeZone() {
  return (
    <DateField
      label="Outage starts"
      defaultValue={Temporal.ZonedDateTime.from("2026-10-25T02:30+02:00[Europe/Oslo]")}
    />
  );
}
