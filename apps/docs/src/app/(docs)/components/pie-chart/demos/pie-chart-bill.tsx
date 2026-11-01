"use client";

import { PieChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const bill = [
  { part: "energy", kr: 612 },
  { part: "grid", kr: 438 },
  { part: "taxes", kr: 287 },
  { part: "fee", kr: 49 },
] as const;

const config = {
  energy: { label: "Energy", color: "chart-1" },
  grid: { label: "Grid rent", color: "chart-2" },
  taxes: { label: "Taxes", color: "chart-3" },
  fee: { label: "Monthly fee", color: "chart-4" },
} as const satisfies ChartConfig;

export function PieChartBill() {
  return (
    <PieChart.Root
      data={bill}
      config={config}
      nameKey="part"
      valueKey="kr"
      valueFormat={{ style: "currency", currency: "NOK", maximumFractionDigits: 0 }}
      innerRadius={0.62}
      padAngle={1.5}
      aria-label="Electricity bill for October">
      <PieChart.Glow dataKey="energy" />
      <PieChart.Pie cornerRadius={0.04} />
      <PieChart.Labels position="outside" />
      <PieChart.Center>
        <PieChart.CenterValue />
        <PieChart.CenterLabel>Total</PieChart.CenterLabel>
      </PieChart.Center>
      <PieChart.LegendToggleGroup />
      <PieChart.Tooltip>
        <PieChart.TooltipLabel />
        <PieChart.TooltipItems>
          <PieChart.Swatch />
          <PieChart.TooltipShare />
          <PieChart.TooltipValue />
        </PieChart.TooltipItems>
      </PieChart.Tooltip>
      <PieChart.Table />
    </PieChart.Root>
  );
}
