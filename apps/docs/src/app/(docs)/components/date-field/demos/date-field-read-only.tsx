"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldReadOnly() {
  return <DateField label="Moving date" isReadOnly defaultValue={Temporal.PlainDate.from("2026-10-05")} />;
}
