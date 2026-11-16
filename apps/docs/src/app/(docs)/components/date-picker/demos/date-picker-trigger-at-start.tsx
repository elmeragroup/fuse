"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerTriggerAtStart() {
  return (
    <DatePickerField
      label="Moving date"
      triggerPlacement="start"
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
    />
  );
}
