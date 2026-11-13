"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldTime() {
  return (
    <div className="max-w-xs flex w-full flex-col gap-4">
      <DateField
        label="Meter read at"
        granularity="minute"
        hourCycle={24}
        defaultValue={Temporal.PlainDateTime.from("2026-10-12T14:30")}
      />
      <DateField
        label="Delivered at"
        granularity="minute"
        hourCycle={12}
        defaultValue={Temporal.PlainDateTime.from("2026-10-12T14:30")}
        isReadOnly
      />
    </div>
  );
}
