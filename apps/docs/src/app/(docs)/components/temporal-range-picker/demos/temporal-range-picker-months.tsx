"use client";

import { useSyncExternalStore } from "react";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

const WIDE = "(min-width: 48rem)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Two months from a tablet up, one on a phone: the host picks the count from its own layout. */
function useVisibleMonths(): number {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(WIDE).matches ? 2 : 1),
    () => 1
  );
}

export function TemporalRangePickerMonths() {
  const visibleMonths = useVisibleMonths();
  return (
    <DateRangePickerField<Temporal.PlainDate>
      className="max-w-md"
      label="Campaign"
      visibleMonths={visibleMonths}
      defaultValue={{ start: "2026-10-26", end: "2026-11-06" }}
    />
  );
}
