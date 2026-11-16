"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerEmptyZonedPicker() {
  return <DateRangePickerField label="Statistics period" granularity="minute" timeZone="Europe/Oslo" />;
}
