"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** One household's usage per year from 2020 to 2025. Oslo's new year starts at 23:00 UTC on 31 December. */
const rows = [19840, 20310, 17650, 16920, 17480, 16790].map((kwh, index) => ({
  year: new Date(Date.UTC(2020 + index, 0, 1, -1)),
  kwh,
}));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function ChartIntervalYear() {
  return (
    <Chart.Root
      data={rows}
      config={config}
      xKey="year"
      interval="year"
      timeZone="Europe/Oslo"
      aria-label="Usage per year, 2020 to 2025">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
