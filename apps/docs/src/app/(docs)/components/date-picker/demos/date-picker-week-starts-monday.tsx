"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerWeekStartsMonday() {
  return (
    <DatePickerField
      label="Moving date"
      firstDayOfWeek="mon"
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
    />
  );
}
