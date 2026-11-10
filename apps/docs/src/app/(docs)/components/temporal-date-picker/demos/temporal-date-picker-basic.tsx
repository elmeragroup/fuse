"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function TemporalDatePickerBasic() {
  return (
    <DatePickerField<Temporal.PlainDate>
      className="max-w-xs w-full"
      label="Moving date"
      description="Type it or pick it from the calendar."
      defaultValue="2026-10-05"
    />
  );
}
