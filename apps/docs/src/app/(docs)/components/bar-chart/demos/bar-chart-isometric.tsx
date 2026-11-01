"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One household's electricity bill per month, energy and grid rent together. A cold February with
// high spot prices costs the most.
const data = [
  { month: "Jan", cost: 2860 },
  { month: "Feb", cost: 3240 },
  { month: "Mar", cost: 2410 },
  { month: "Apr", cost: 1690 },
  { month: "May", cost: 1120 },
  { month: "Jun", cost: 780 },
  { month: "Jul", cost: 690 },
];

const config = {
  cost: {
    label: "Cost",
    color: "chart-1",
    format: { style: "currency", currency: "NOK", maximumFractionDigits: 0 },
    barVariant: "isometric",
  },
} as const satisfies ChartConfig;

export function BarChartIsometric() {
  return (
    // A short plot keeps the demo compact. It is 55px tall below the 640px breakpoint and 175px
    // from it.
    <BarChart.Root
      data={data}
      config={config}
      xKey="month"
      className="sm:[--chart-plot-height:175px] [--chart-plot-height:55px]"
      aria-label="Electricity cost per month">
      <BarChart.XAxis />
      <BarChart.Bar dataKey="cost" emphasis="max" emphasisLabel="peak" />
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
