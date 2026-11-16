"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldBounds() {
  // The field shows its own error only after a blur, so `isInvalid` marks the August date from the start.
  return (
    <DateField
      label="Installation date"
      minValue={Temporal.PlainDate.from("2026-07-01")}
      maxValue={Temporal.PlainDate.from("2026-07-31")}
      defaultValue={Temporal.PlainDate.from("2026-08-03")}
      isInvalid
      errorMessage="Choose a date in July 2026."
    />
  );
}
