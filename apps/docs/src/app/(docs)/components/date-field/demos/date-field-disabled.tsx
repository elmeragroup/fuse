"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldDisabled() {
  return <DateField label="Moving date" isDisabled defaultValue={Temporal.PlainDate.from("2026-10-05")} />;
}
