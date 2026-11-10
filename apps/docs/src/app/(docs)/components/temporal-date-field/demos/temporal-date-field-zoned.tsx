"use client";

import { useState } from "react";

import { DateField } from "@elmeragroup/fuse/date-field";

export function TemporalDateFieldZoned() {
  const [value, setValue] = useState<Temporal.ZonedDateTime | null>(null);
  return (
    <div className="max-w-sm flex w-full flex-col gap-4">
      {/* Empty, so `timeZone` names the zone the typed value takes. */}
      <DateField<Temporal.ZonedDateTime>
        label="Outage starts"
        granularity="minute"
        hourCycle={24}
        timeZone="Europe/Oslo"
        value={value}
        onChange={setValue}
      />
      <DateField<Temporal.ZonedDateTime>
        label="Outage starts (hidden zone)"
        granularity="minute"
        hourCycle={24}
        hideTimeZone
        defaultValue="2026-10-25T02:30+02:00[Europe/Oslo]"
      />
      <output className="text-sm text-muted-foreground">Value: {value?.toString() ?? "none"}</output>
    </div>
  );
}
