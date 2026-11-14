"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** One household's usage on the first fourteen days of October 2026. Oslo midnight is 22:00 UTC the day before in summer time. */
const rows = [31.4, 29.8, 34.2, 38.9, 30.1, 28.7, 29.5, 31.2, 33.6, 40.2, 41.8, 30.4, 29.9, 32.1].map(
  (kwh, index) => ({
    day: new Date(Date.UTC(2026, 8, 30 + index, 22)),
    kwh,
  })
);

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 1 },
  },
} as const satisfies ChartConfig;

export function ChartIntervalDay() {
  return (
    <Chart.Root
      data={rows}
      config={config}
      xKey="day"
      interval="day"
      timeZone="Europe/Oslo"
      aria-label="Usage per day, 1 to 14 October 2026">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
