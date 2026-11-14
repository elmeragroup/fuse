"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldError() {
  return (
    <DateField
      label="Moving date"
      isInvalid
      errorMessage="Choose a date after the lease ends."
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
    />
  );
}
