"use client";

import { PieChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// A new customer's first bill, which has no lines yet.
const bill: { part: string; kr: number }[] = [];

const config = {
  energy: { label: "Energy", color: "chart-1" },
  rent: { label: "Grid rent", color: "chart-2" },
} as const satisfies ChartConfig;

export function PieChartEmpty() {
  return (
    <PieChart.Root data={bill} config={config} nameKey="part" valueKey="kr" aria-label="Electricity bill">
      <PieChart.Pie />
      <PieChart.Empty />
    </PieChart.Root>
  );
}
