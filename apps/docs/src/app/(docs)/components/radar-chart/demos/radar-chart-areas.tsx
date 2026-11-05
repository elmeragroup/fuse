"use client";

import { RadarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Illustrative values: each consumption group's use per metering point in four price areas, as an
// index where 100 is the group's mean over the areas.
const groups = [
  { group: "Households", no1: 104, no2: 96, no3: 98, no4: 112 },
  { group: "Cabins", no1: 88, no2: 131, no3: 84, no4: 97 },
  { group: "Primary", no1: 92, no2: 79, no3: 126, no4: 118 },
  { group: "Industry", no1: 83, no2: 141, no3: 107, no4: 76 },
  { group: "Services", no1: 109, no2: 94, no3: 101, no4: 89 },
];

const config = {
  no1: { label: "NO1", color: "chart-1" },
  no2: { label: "NO2", color: "chart-2" },
  no3: { label: "NO3", color: "chart-3" },
  no4: { label: "NO4", color: "chart-4" },
} as const satisfies ChartConfig;

export function RadarChartAreas() {
  return (
    <RadarChart.Root
      data={groups}
      config={config}
      nameKey="group"
      aria-label="Use per metering point by consumption group and price area, as an index">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.RadiusAxis />
      <RadarChart.Line dataKey="no1" />
      <RadarChart.Line dataKey="no2" />
      <RadarChart.Line dataKey="no3" />
      <RadarChart.Line dataKey="no4" />
      <RadarChart.Dots dataKey="no1" variant="ring" />
      <RadarChart.Legend />
      <RadarChart.Tooltip />
      <RadarChart.Table />
    </RadarChart.Root>
  );
}
