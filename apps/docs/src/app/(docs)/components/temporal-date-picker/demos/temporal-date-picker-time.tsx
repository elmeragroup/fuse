"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function TemporalDatePickerTime() {
  return (
    <div className="max-w-xs flex w-full flex-col gap-4">
      <DatePickerField<Temporal.PlainDateTime>
        label="Delivery window starts"
        granularity="minute"
        defaultValue="2026-10-05T08:30"
      />
      <DatePickerField<Temporal.ZonedDateTime>
        label="Outage starts (Oslo)"
        granularity="minute"
        hourCycle={24}
        hideTimeZone
        timeZone="Europe/Oslo"
        defaultValue="2026-10-24T22:00[Europe/Oslo]"
        firstDayOfWeek="mon"
      />
    </div>
  );
}
