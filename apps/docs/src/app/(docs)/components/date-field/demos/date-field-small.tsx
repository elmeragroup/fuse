"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldSmall() {
  return <DateField label="Moving date" size="sm" defaultValue={Temporal.PlainDate.from("2026-10-05")} />;
}
