"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** Twenty seconds of a house's power draw from 08:00:00 in Oslo on 17 October 2026, as a kettle starts. */
const rows = [
  1.2, 1.2, 1.3, 1.2, 3.4, 3.5, 3.5, 3.4, 3.5, 3.5, 3.4, 3.5, 3.5, 3.4, 3.5, 1.3, 1.2, 1.2, 1.3, 1.2,
].map((kw, index) => ({
  start: new Date(Date.UTC(2026, 9, 17, 6, 0, index)),
  kw,
}));

const config = {
  kw: { label: "Power", color: "chart-1", format: { preset: "power", unit: "kW", maximumFractionDigits: 1 } },
} as const satisfies ChartConfig;

export function ChartIntervalSecond() {
  return (
    <Chart.Root
      data={rows}
      config={config}
      xKey="start"
      interval="second"
      timeZone="Europe/Oslo"
      aria-label="Power draw per second, 08:00 on 17 October">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kw" />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
