"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerTime() {
  return (
    <div className="max-w-xs flex w-full flex-col gap-4">
      <DatePickerField
        label="Delivery window starts"
        granularity="minute"
        defaultValue={Temporal.PlainDateTime.from("2026-10-05T08:30")}
      />
      <DatePickerField
        label="Outage starts (Oslo)"
        granularity="minute"
        hourCycle={24}
        hideTimeZone
        timeZone="Europe/Oslo"
        defaultValue={Temporal.ZonedDateTime.from("2026-10-24T22:00[Europe/Oslo]")}
        firstDayOfWeek="mon"
      />
    </div>
  );
}
