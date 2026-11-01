"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const data = [
  { month: "January", kwh: 2412 },
  { month: "February", kwh: 2168 },
  { month: "March", kwh: 1893 },
  { month: "April", kwh: 1447 },
  { month: "May", kwh: 1062 },
  { month: "June", kwh: 806 },
];

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function BarChartHorizontal() {
  return (
    <BarChart.Root
      data={data}
      config={config}
      xKey="month"
      orientation="horizontal"
      aria-label="Consumption per month, January to June">
      <BarChart.Grid />
      <BarChart.XAxis />
      <BarChart.YAxis />
      <BarChart.Bar dataKey="kwh" />
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
