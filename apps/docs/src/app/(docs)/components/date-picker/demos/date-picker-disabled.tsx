"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerDisabled() {
  return (
    <DatePickerField label="Moving date" isDisabled defaultValue={Temporal.PlainDate.from("2026-10-05")} />
  );
}
