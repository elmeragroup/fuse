"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldDateAndTime() {
  return <DateField label="Meter read at" defaultValue={Temporal.PlainDateTime.from("2026-10-12T14:30")} />;
}
