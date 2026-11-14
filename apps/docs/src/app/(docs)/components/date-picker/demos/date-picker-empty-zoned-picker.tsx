"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerEmptyZonedPicker() {
  return <DatePickerField label="Outage starts" granularity="minute" timeZone="Europe/Oslo" />;
}
