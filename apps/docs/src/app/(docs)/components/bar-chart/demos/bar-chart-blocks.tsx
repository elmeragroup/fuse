"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const data = [
  { month: "Jan", kwh: 2412 },
  { month: "Feb", kwh: 2168 },
  { month: "Mar", kwh: 1893 },
  { month: "Apr", kwh: 1447 },
  { month: "May", kwh: 1062 },
  { month: "Jun", kwh: 806 },
  { month: "Jul", kwh: 731 },
  { month: "Aug", kwh: 788 },
  { month: "Sep", kwh: 1004 },
  { month: "Oct", kwh: 1458 },
  { month: "Nov", kwh: 1917 },
  { month: "Dec", kwh: 2296 },
];

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    barVariant: "blocks",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function BarChartBlocks() {
  return (
    // A short plot keeps the demo compact. It is 91px tall below the 640px breakpoint and 195px
    // from it.
    <BarChart.Root
      data={data}
      config={config}
      xKey="month"
      className="sm:[--chart-plot-height:195px] [--chart-plot-height:91px]"
      aria-label="Consumption per month">
      <BarChart.XAxis />
      <BarChart.Bar dataKey="kwh" />
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
