"use client";

import { RadarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const weekdays = [
  { day: "Mon", thisWeek: 14.2, lastWeek: 15.1 },
  { day: "Tue", thisWeek: 13.8, lastWeek: 14.6 },
  { day: "Wed", thisWeek: 15.4, lastWeek: 14.9 },
  { day: "Thu", thisWeek: 16.1, lastWeek: 15.8 },
  { day: "Fri", thisWeek: 12.7, lastWeek: 13.9 },
  { day: "Sat", thisWeek: 18.3, lastWeek: 17.2 },
  { day: "Sun", thisWeek: 19.0, lastWeek: 18.4 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

const config = {
  thisWeek: { label: "This week", color: "chart-1", format: energy },
  lastWeek: { label: "Last week", color: "chart-2", format: energy },
} as const satisfies ChartConfig;

export function RadarChartWeekdays() {
  return (
    <RadarChart.Root data={weekdays} config={config} nameKey="day" aria-label="Usage per weekday">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.RadiusAxis />
      <RadarChart.Glow>
        <RadarChart.Area dataKey="thisWeek" />
        <RadarChart.Line dataKey="thisWeek" />
      </RadarChart.Glow>
      <RadarChart.Line dataKey="lastWeek" variant="dashed" />
      <RadarChart.ActiveDot dataKey="thisWeek" />
      <RadarChart.Legend />
      <RadarChart.Tooltip />
      <RadarChart.Table />
    </RadarChart.Root>
  );
}
