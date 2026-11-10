"use client";

import { useState } from "react";

import { parseDate } from "@internationalized/date";
import type { CalendarDate } from "@internationalized/date";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

// Code not yet moved off @internationalized/date: a CalendarDate from the domain layer.
const legacyStart: CalendarDate = parseDate("2026-10-05");

export function TemporalConversion() {
  // ISO text is the bridge: both libraries print and parse the same string. The picker takes it
  // as is, or as a Temporal.PlainDate, and hands back this runtime's Temporal.PlainDate.
  const [value, setValue] = useState<Temporal.PlainDate | string | null>(legacyStart.toString());
  const iso = value === null ? null : value.toString();

  return (
    <div className="max-w-xs flex w-full flex-col gap-2">
      <DatePickerField<Temporal.PlainDate> label="Moving date" value={value} onChange={setValue} />
      <output className="text-sm flex flex-col gap-1 text-muted-foreground">
        <span>ISO for the server: {iso ?? "none"}</span>
        <span>
          Back to @internationalized/date:{" "}
          {iso === null ? "none" : `parseDate("${parseDate(iso).toString()}")`}
        </span>
      </output>
    </div>
  );
}
