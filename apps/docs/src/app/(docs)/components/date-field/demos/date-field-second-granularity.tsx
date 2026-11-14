"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldSecondGranularity() {
  return (
    <DateField
      label="Meter read at"
      granularity="second"
      defaultValue={Temporal.PlainDateTime.from("2026-10-12T14:30")}
    />
  );
}
