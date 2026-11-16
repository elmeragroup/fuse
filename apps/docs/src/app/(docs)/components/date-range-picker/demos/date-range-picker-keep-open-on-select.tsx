"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerKeepOpenOnSelect() {
  return <DateRangePickerField label="Statistics period" granularity="minute" shouldCloseOnSelect={false} />;
}
