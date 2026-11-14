"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerKeepOpenOnSelect() {
  return <DatePickerField label="Delivery window starts" granularity="minute" shouldCloseOnSelect={false} />;
}
