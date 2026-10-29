"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const config = {
  kwh: { label: "Usage", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
} as const satisfies ChartConfig;

/** One hour of the day's rows, of which none has arrived yet. */
type HourRow = { readonly start: Date; readonly kwh: number | null };

const hours: readonly HourRow[] = [];

/** No reading yet for the day, so the plot shows Empty, and the chart has no tab stop and no table. */
export function ChartEmptyState() {
  return (
    <Chart.Root
      data={hours}
      config={config}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      period={[new Date(Date.UTC(2026, 9, 17, -2)), new Date(Date.UTC(2026, 9, 18, -2))]}
      aria-label="Usage per hour, 17 October">
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Empty />
      <Chart.Table />
    </Chart.Root>
  );
}
