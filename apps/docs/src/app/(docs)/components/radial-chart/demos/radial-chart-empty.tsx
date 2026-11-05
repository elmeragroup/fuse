"use client";

import { RadialChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// A new meter with no readings yet this month.
const rings: { budget: string; kwh: number; limit: number }[] = [];

const config = {
  heating: { label: "Heating", color: "chart-1" },
  water: { label: "Hot water", color: "chart-2" },
} as const satisfies ChartConfig;

export function RadialChartEmpty() {
  return (
    <RadialChart.Root
      data={rings}
      config={config}
      nameKey="budget"
      valueKey="kwh"
      maxKey="limit"
      aria-label="Usage against budget">
      <RadialChart.Bar />
      <RadialChart.Empty />
    </RadialChart.Root>
  );
}
