"use client";

import { useSyncExternalStore } from "react";

import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";

const WIDE = "(width >= 48rem)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(WIDE);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** Two months side by side where they fit, one on a narrow screen. The server renders one. */
function useMonthCount(): number {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => false
  );
  return wide ? 2 : 1;
}

export function TemporalRangeCalendarMonths() {
  const visibleMonths = useMonthCount();
  return (
    <RangeCalendar.Root
      aria-label="Billing period"
      defaultValue={{ start: "2026-10-26", end: "2026-11-06" }}
      visibleMonths={visibleMonths}>
      <RangeCalendar.Header>
        <RangeCalendar.DecrementMonth />
        <RangeCalendar.VisibleRangeHeading className="sr-only" />
        <div className="flex-1" />
        <RangeCalendar.IncrementMonth />
      </RangeCalendar.Header>
      <RangeCalendar.Months>
        {(month) => (
          <RangeCalendar.Month key={month.toString()} value={month}>
            <RangeCalendar.MonthHeading />
            <RangeCalendar.DayGrid>
              <RangeCalendar.DayGridHeader />
              <RangeCalendar.DayGridBody />
            </RangeCalendar.DayGrid>
          </RangeCalendar.Month>
        )}
      </RangeCalendar.Months>
    </RangeCalendar.Root>
  );
}
