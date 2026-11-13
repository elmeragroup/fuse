"use client";

import { useSyncExternalStore } from "react";

import { Calendar } from "@elmeragroup/fuse/calendar";

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

export function CalendarMonths() {
  const visibleMonths = useMonthCount();
  return (
    <Calendar.Root
      aria-label="Check-in"
      defaultValue={Temporal.PlainDate.from("2026-10-14")}
      visibleMonths={visibleMonths}>
      <Calendar.Header>
        <Calendar.DecrementMonth />
        <Calendar.VisibleRangeHeading className="sr-only" />
        <div className="flex-1" />
        <Calendar.IncrementMonth />
      </Calendar.Header>
      <Calendar.Months>
        {(month) => (
          <Calendar.Month key={month.toString()} value={month}>
            <Calendar.MonthHeading />
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
