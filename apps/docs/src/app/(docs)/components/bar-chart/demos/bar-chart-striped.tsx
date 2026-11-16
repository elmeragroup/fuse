"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One household's consumption per month.
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
    barVariant: "striped",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function BarChartStriped() {
  return (
    <BarChart.Root data={data} config={config} xKey="month" aria-label="Consumption per month">
      <BarChart.Grid />
      <BarChart.YAxis />
      <BarChart.XAxis />
      <BarChart.Bar dataKey="kwh" />
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
