"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** Thirty minutes of a house's power draw from 18:00 in Oslo on 17 October 2026, with the oven on from 18:10. */
const rows = [
  1.1, 1.0, 1.2, 1.1, 1.3, 1.2, 1.1, 1.2, 1.0, 1.1, 3.6, 3.8, 3.7, 3.5, 3.7, 3.8, 3.6, 3.7, 3.5, 3.6, 2.4,
  2.2, 2.5, 2.3, 2.4, 1.2, 1.1, 1.3, 1.2, 1.1,
].map((kw, index) => ({
  start: new Date(Date.UTC(2026, 9, 17, 16, index)),
  kw,
}));

const config = {
  kw: { label: "Power", color: "chart-1", format: { preset: "power", unit: "kW", maximumFractionDigits: 1 } },
} as const satisfies ChartConfig;

export function ChartIntervalMinute() {
  return (
    <Chart.Root
      data={rows}
      config={config}
      xKey="start"
      interval="minute"
      timeZone="Europe/Oslo"
      aria-label="Power draw per minute, 18:00 to 18:30 on 17 October">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kw" />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
