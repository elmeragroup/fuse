"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

/** The nights a fully booked cabin has no room, as a booking system would report them. */
const BOOKED = new Set(["2026-10-14", "2026-10-15", "2026-10-21"]);

function isBooked(date: Temporal.PlainDate): boolean {
  return BOOKED.has(date.toString());
}

export function DateRangePickerUnavailableDates() {
  return (
    <DateRangePickerField
      label="Cabin stay"
      description="Booked nights are struck through."
      isDateUnavailable={isBooked}
      defaultValue={{
        start: Temporal.PlainDate.from("2026-10-05"),
        end: Temporal.PlainDate.from("2026-10-09"),
      }}
    />
  );
}
