"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerSmall() {
  return (
    <DatePickerField label="Moving date" size="sm" defaultValue={Temporal.PlainDate.from("2026-10-05")} />
  );
}
