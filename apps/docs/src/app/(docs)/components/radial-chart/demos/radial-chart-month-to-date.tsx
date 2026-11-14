"use client";

import { RadialChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The 16th of a 31-day month: consumption and cost so far against the month's budgets.
const month = [
  { measure: "energy", used: 287, budget: 450 },
  { measure: "cost", used: 612, budget: 900 },
];

const config = {
  energy: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
  cost: {
    label: "Cost",
    color: "chart-2",
    format: { style: "currency", currency: "NOK", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function RadialChartMonthToDate() {
  return (
    <RadialChart.Root
      data={month}
      config={config}
      nameKey="measure"
      valueKey="used"
      maxKey="budget"
      defaultActiveKey="energy"
      innerRadius={0.45}
      aria-label="Month to date against budget">
      <RadialChart.Track />
      <RadialChart.Bar />
      <RadialChart.Center>
        <RadialChart.CenterShare />
      </RadialChart.Center>
      <RadialChart.Tooltip />
      <RadialChart.Table />
    </RadialChart.Root>
  );
}
