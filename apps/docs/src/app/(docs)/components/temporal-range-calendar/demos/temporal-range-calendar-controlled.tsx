"use client";

import { useState } from "react";

import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";
import type { RangeCalendarValue } from "@elmeragroup/fuse/range-calendar";

/** The longest stay the booking rules allow. */
const MAX_NIGHTS = 7;

export function TemporalRangeCalendarControlled() {
  const [value, setValue] = useState<RangeCalendarValue | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-4">
      <RangeCalendar.Root
        aria-label="Stay"
        value={value}
        onValueChange={(next, details) => {
          // A canceled day press keeps the value and the first day, so another end can be picked.
          if (next.start.until(next.end).days > MAX_NIGHTS) {
            details.cancel();
            setRefused(
              `${next.start.toString()} to ${next.end.toString()} is longer than ${MAX_NIGHTS} nights.`
            );
            return;
          }
          setRefused(null);
          setValue(next);
        }}>
        <RangeCalendar.Header>
          <RangeCalendar.DecrementMonth />
          <RangeCalendar.VisibleRangeHeading />
          <RangeCalendar.IncrementMonth />
        </RangeCalendar.Header>
        <RangeCalendar.Months />
      </RangeCalendar.Root>
      <output className="text-sm">
        {value === null ? "No stay selected" : `Stay: ${value.start.toString()} to ${value.end.toString()}`}
      </output>
      <p role="status" className="text-sm text-error">
        {refused}
      </p>
    </div>
  );
}
