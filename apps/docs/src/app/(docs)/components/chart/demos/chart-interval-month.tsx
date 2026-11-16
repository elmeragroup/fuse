"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** The first instant of an Oslo month, which starts in summer time from April to October. */
function osloMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, month >= 4 && month <= 10 ? -2 : -1));
}

/** One household's usage per month in 2025. */
const rows = [2412, 2168, 1893, 1447, 1062, 806, 731, 788, 1004, 1458, 1917, 2296].map((kwh, index) => ({
  month: osloMonth(2025, index + 1),
  kwh,
}));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function ChartIntervalMonth() {
  return (
    <Chart.Root
      data={rows}
      config={config}
      xKey="month"
      interval="month"
      timeZone="Europe/Oslo"
      aria-label="Usage per month, 2025">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
