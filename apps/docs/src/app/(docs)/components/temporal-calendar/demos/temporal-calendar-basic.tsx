"use client";

import { Calendar } from "@elmeragroup/fuse/calendar";

export function TemporalCalendarBasic() {
  return (
    <Calendar.Root aria-label="Delivery date" defaultValue="2026-10-14">
      <Calendar.Header>
        <Calendar.DecrementMonth />
        <Calendar.VisibleRangeHeading />
        <Calendar.IncrementMonth />
      </Calendar.Header>
      <Calendar.Months>
        {(month) => (
          <Calendar.Month key={month.toString()} value={month}>
            {/* The heading above already shows the month; this one names the grid. */}
            <Calendar.MonthHeading className="sr-only" />
            <Calendar.DayGrid>
              <Calendar.DayGridHeader />
              <Calendar.DayGridBody />
            </Calendar.DayGrid>
          </Calendar.Month>
        )}
      </Calendar.Months>
    </Calendar.Root>
  );
}
