"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateField24HourClock() {
  return (
    <DateField
      label="Meter read at"
      hourCycle={24}
      defaultValue={Temporal.PlainDateTime.from("2026-10-12T14:30")}
    />
  );
}
