"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerBounds() {
  return (
    <DatePickerField
      label="Installation date"
      description="A date in October 2026."
      minValue={Temporal.PlainDate.from("2026-10-01")}
      maxValue={Temporal.PlainDate.from("2026-10-31")}
      defaultValue={Temporal.PlainDate.from("2026-10-14")}
    />
  );
}
