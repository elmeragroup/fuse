"use client";

import { PieChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One household's electricity bill for October, in kroner.
const bill = [
  { part: "energy", kr: 612 },
  { part: "rent", kr: 438 },
  { part: "taxes", kr: 287 },
  { part: "fee", kr: 49 },
];

const config = {
  energy: { label: "Energy", color: "chart-1" },
  rent: { label: "Grid rent", color: "chart-2" },
  taxes: { label: "Taxes", color: "chart-3" },
  fee: { label: "Monthly fee", color: "chart-4" },
} as const satisfies ChartConfig;

export function PieChartFrostedTooltip() {
  return (
    <PieChart.Root
      data={bill}
      config={config}
      nameKey="part"
      valueKey="kr"
      valueFormat={{ style: "currency", currency: "NOK", maximumFractionDigits: 0 }}
      defaultActiveKey="energy"
      aria-label="Electricity bill for October">
      <PieChart.Pie />
      <PieChart.Tooltip variant="frosted" />
      <PieChart.Table />
    </PieChart.Root>
  );
}
