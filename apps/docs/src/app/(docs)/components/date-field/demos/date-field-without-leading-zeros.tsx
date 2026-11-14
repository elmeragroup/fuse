"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldWithoutLeadingZeros() {
  return (
    <DateField
      label="Moving date"
      shouldForceLeadingZeros={false}
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
    />
  );
}
