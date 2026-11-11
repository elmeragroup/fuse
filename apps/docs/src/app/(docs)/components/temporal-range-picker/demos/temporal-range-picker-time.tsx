"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function TemporalRangePickerTime() {
  return (
    <DateRangePickerField
      className="max-w-md"
      label="Statistics period"
      granularity="minute"
      hourCycle={24}
      hideTimeZone
      timeZone="Europe/Oslo"
      shouldCloseOnSelect={false}
      firstDayOfWeek="mon"
    />
  );
}
