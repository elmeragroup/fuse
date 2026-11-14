"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerReadOnly() {
  return (
    <DatePickerField label="Moving date" isReadOnly defaultValue={Temporal.PlainDate.from("2026-10-05")} />
  );
}
