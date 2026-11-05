import { RadarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Illustrative values: how far each consumption group's use per metering point lies from its mean
// over the price areas, in index points, for two areas.
const groups = [
  { group: "Households", no1: 4, no2: -4 },
  { group: "Cabins", no1: -12, no2: 31 },
  { group: "Primary", no1: -8, no2: -21 },
  { group: "Industry", no1: -17, no2: 41 },
  { group: "Services", no1: 9, no2: -6 },
];

const config = {
  no1: { label: "NO1", color: "chart-1" },
  no2: { label: "NO2", color: "chart-2" },
} as const satisfies ChartConfig;

/**
 * A server component. The file has no `"use client"` line, and every prop it passes is plain data,
 * so the server writes the grid, the labels and the series, and sends only the chart's own parts to
 * the browser.
 */
export function RadarChartDeviation() {
  return (
    <RadarChart.Root
      data={groups}
      config={config}
      nameKey="group"
      aria-label="Deviation from the mean over the price areas, in index points">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.RadiusAxis />
      <RadarChart.Area dataKey="no1" />
      <RadarChart.Line dataKey="no1" />
      <RadarChart.Area dataKey="no2" />
      <RadarChart.Line dataKey="no2" />
      <RadarChart.Legend />
      <RadarChart.Tooltip />
      <RadarChart.Table />
    </RadarChart.Root>
  );
}
