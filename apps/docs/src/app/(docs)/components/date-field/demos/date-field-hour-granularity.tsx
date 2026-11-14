"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldHourGranularity() {
  return (
    <DateField
      label="Meter read at"
      granularity="hour"
      defaultValue={Temporal.PlainDateTime.from("2026-10-12T14:30")}
    />
  );
}
