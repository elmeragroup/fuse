"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const months = [
  { month: "Jan", kwh: 1820 },
  { month: "Feb", kwh: 1640 },
  { month: "Mar", kwh: 1390 },
  { month: "Apr", kwh: 980 },
  { month: "May", kwh: 720 },
  { month: "Jun", kwh: 540 },
];

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

/** The bars draw at rest, with no entrance. */
export function ChartEntranceNone() {
  return (
    <Chart.Root
      data={months}
      config={config}
      xKey="month"
      data-intro="none"
      aria-label="Consumption per month">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
