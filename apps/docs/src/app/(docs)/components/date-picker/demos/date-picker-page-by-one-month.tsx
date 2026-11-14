"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerPageByOneMonth() {
  return (
    <DatePickerField
      label="Moving date"
      visibleMonths={2}
      pageBehavior="single"
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
    />
  );
}
