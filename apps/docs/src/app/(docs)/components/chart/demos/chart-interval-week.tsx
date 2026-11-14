"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** One household's usage in the seven ISO weeks from Monday 7 September 2026, each starting at Oslo midnight in summer time. */
const rows = [168, 174, 181, 195, 204, 219, 231].map((kwh, index) => ({
  week: new Date(Date.UTC(2026, 8, 6 + index * 7, 22)),
  kwh,
}));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function ChartIntervalWeek() {
  return (
    <Chart.Root
      data={rows}
      config={config}
      xKey="week"
      interval="week"
      timeZone="Europe/Oslo"
      aria-label="Usage per week, 7 September to 25 October 2026">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
