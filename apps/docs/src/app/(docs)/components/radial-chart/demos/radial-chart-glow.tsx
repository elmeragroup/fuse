"use client";

import { RadialChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// This month's consumption against each group's budget, in kWh.
const rings = [
  { budget: "heating", kwh: 412, limit: 500 },
  { budget: "water", kwh: 168, limit: 200 },
  { budget: "charging", kwh: 133, limit: 180 },
];

const config = {
  heating: { label: "Heating", color: "chart-1" },
  water: { label: "Hot water", color: "chart-2" },
  charging: { label: "Car charging", color: "chart-3" },
} as const satisfies ChartConfig;

export function RadialChartGlow() {
  return (
    <RadialChart.Root
      data={rings}
      config={config}
      nameKey="budget"
      valueKey="kwh"
      maxKey="limit"
      valueFormat={{ preset: "energy", unit: "kWh", maximumFractionDigits: 0 }}
      aria-label="Usage against budget this month">
      <RadialChart.Track />
      <RadialChart.Glow dataKey="heating" />
      <RadialChart.Bar />
      <RadialChart.Tooltip />
      <RadialChart.Table />
    </RadialChart.Root>
  );
}
