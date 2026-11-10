"use client";

import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";

/** The days a fully booked cabin has no room, as a booking system would report them. */
const BOOKED = new Set(["2026-10-09", "2026-10-10", "2026-10-21", "2026-10-22", "2026-10-23"]);

/** Defined once, outside the component, so every day does not re-render on each render. */
function isBooked(date: Temporal.PlainDate): boolean {
  return BOOKED.has(date.toString());
}

export function TemporalRangeCalendarUnavailable() {
  return (
    <RangeCalendar.Root
      aria-label="Cabin stay"
      defaultValue={{ start: "2026-10-13", end: "2026-10-15" }}
      minValue="2026-10-05"
      maxValue="2026-11-15"
      isDateUnavailable={isBooked}>
      <RangeCalendar.Header>
        <RangeCalendar.DecrementMonth />
        <RangeCalendar.VisibleRangeHeading />
        <RangeCalendar.IncrementMonth />
      </RangeCalendar.Header>
      <RangeCalendar.Months />
    </RangeCalendar.Root>
  );
}
