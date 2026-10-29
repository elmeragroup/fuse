"use client";

import { useChartRoot } from "./chart-context";
import { useActivePoint } from "./chart-readout";
import { slotLabel } from "./chart-text";
import type { ChartPoint, ChartQuality } from "./chart-types";
import { slotX } from "./layout/x-domain";

/**
 * The active point of the enclosing chart, or null when nothing is active. The caller renders on
 * every index change, so keep the component that reads it small, such as a headline figure. A
 * pending reading reports null with no quality, and a missing one reports null with `"missing"`.
 *
 * @returns The active point, or null.
 * @throws When no `Chart.Root` encloses the caller, as `part-outside-root`.
 * @beta
 */
export function useChartPoint(): ChartPoint | null {
  const context = useChartRoot("useChartPoint");
  const { slot, key } = useActivePoint(context, true);
  if (slot === null) return null;
  const values: Record<string, number | null> = {};
  const quality: Record<string, ChartQuality> = {};
  for (const series of context.model.series) {
    const reading = series.readings[slot];
    values[series.key] = reading?.kind === "reading" ? reading.value : null;
    if (reading?.kind === "reading") quality[series.key] = reading.quality;
    else if (reading?.kind === "missing") quality[series.key] = "missing";
  }
  return {
    index: slot,
    x: slotX(context.model.domain, slot),
    label: slotLabel(context, slot),
    key,
    values,
    quality,
  };
}
