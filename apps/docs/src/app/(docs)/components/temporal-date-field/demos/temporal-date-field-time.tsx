"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function TemporalDateFieldTime() {
  return (
    <div className="max-w-xs flex w-full flex-col gap-4">
      <DateField<Temporal.PlainDateTime>
        label="Meter read at"
        granularity="minute"
        hourCycle={24}
        defaultValue="2026-10-12T14:30"
      />
      <DateField<Temporal.PlainDateTime>
        label="Delivered at"
        granularity="minute"
        hourCycle={12}
        defaultValue="2026-10-12T14:30"
        isReadOnly
      />
    </div>
  );
}
