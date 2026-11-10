"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function TemporalRangePickerBasic() {
  return (
    <DateRangePickerField<Temporal.PlainDate>
      className="max-w-md"
      label="Stay"
      description="Check-in and check-out."
      defaultValue={{ start: "2026-10-05", end: "2026-10-09" }}
    />
  );
}
