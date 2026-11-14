"use client";

import { PieChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One household's electricity bill for October, in kroner. Grid rent is estimated until the meter reads.
const bill = [
  { part: "energy", kr: 612, quality: "measured" },
  { part: "rent", kr: 438, quality: "estimated" },
  { part: "taxes", kr: 287, quality: "measured" },
  { part: "fee", kr: 49, quality: "measured" },
] as const;

const config = {
  energy: { label: "Energy", color: "chart-1" },
  rent: { label: "Grid rent", color: "chart-2" },
  taxes: { label: "Taxes", color: "chart-3" },
  fee: { label: "Monthly fee", color: "chart-4" },
} as const satisfies ChartConfig;

export function PieChartEstimated() {
  return (
    <PieChart.Root
      data={bill}
      config={config}
      nameKey="part"
      valueKey="kr"
      valueFormat={{ style: "currency", currency: "NOK", maximumFractionDigits: 0 }}
      qualityKey="quality"
      aria-label="Electricity bill for October">
      <PieChart.Pie />
      <PieChart.Labels />
      <PieChart.Tooltip />
      <PieChart.Table />
    </PieChart.Root>
  );
}
