"use client";

import { RadarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// A new meter with no readings yet.
const weekdays: { day: string; kwh: number }[] = [];

const config = {
  kwh: { label: "This month", color: "chart-1" },
} as const satisfies ChartConfig;

export function RadarChartEmpty() {
  return (
    <RadarChart.Root data={weekdays} config={config} nameKey="day" aria-label="Usage per weekday">
      <RadarChart.Line dataKey="kwh" />
      <RadarChart.Empty />
    </RadarChart.Root>
  );
}
