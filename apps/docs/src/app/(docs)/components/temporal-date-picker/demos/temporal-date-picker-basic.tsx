"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function TemporalDatePickerBasic() {
  return (
    <DatePickerField
      className="max-w-xs w-full"
      label="Moving date"
      description="Type it or pick it from the calendar."
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
    />
  );
}
