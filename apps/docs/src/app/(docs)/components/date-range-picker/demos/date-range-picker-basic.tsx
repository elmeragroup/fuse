"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerBasic() {
  return (
    <DateRangePickerField
      className="max-w-md"
      label="Stay"
      description="Check-in and check-out."
      defaultValue={{
        start: Temporal.PlainDate.from("2026-10-05"),
        end: Temporal.PlainDate.from("2026-10-09"),
      }}
    />
  );
}
