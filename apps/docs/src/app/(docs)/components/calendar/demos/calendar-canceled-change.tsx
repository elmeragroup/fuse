"use client";

import { useState } from "react";

import { Calendar } from "@elmeragroup/fuse/calendar";

export function CalendarCanceledChange() {
  const [value, setValue] = useState(() => Temporal.PlainDate.from("2026-10-14"));
  const [locked, setLocked] = useState(true);
  return (
    <div className="flex flex-col items-start gap-4">
      <Calendar.Root
        aria-label="Meter reading date"
        value={value}
        onValueChange={(next, details) => {
          // A canceled change keeps the value, and focus stays on the pressed day.
          if (locked) {
            details.cancel();
            return;
          }
          setValue(next);
        }}>
        <Calendar.Header>
          <Calendar.DecrementMonth />
          <Calendar.VisibleRangeHeading />
          <Calendar.IncrementMonth />
        </Calendar.Header>
        <Calendar.Months />
      </Calendar.Root>
      <label className="text-sm flex items-center gap-2">
        <input
          type="checkbox"
          checked={locked}
          onChange={(event) => {
            setLocked(event.currentTarget.checked);
          }}
        />
        Lock the date
      </label>
      <output className="text-sm">Selected: {value.toString()}</output>
    </div>
  );
}
