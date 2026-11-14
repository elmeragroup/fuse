"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerSeveralMonths() {
  return (
    <DatePickerField
      label="Moving date"
      visibleMonths={2}
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
    />
  );
}
