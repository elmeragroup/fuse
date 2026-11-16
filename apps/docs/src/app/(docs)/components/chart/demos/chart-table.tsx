"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

import { HOURLY_YEAR_KWH, HOURLY_YEAR_START } from "./data/hourly-year";

const start = Date.parse(HOURLY_YEAR_START);
const hours = HOURLY_YEAR_KWH.map((kwh, index) => ({ start: new Date(start + index * 3_600_000), kwh }));

const config = {
  kwh: {
    label: "Household",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

/** A year of hours, which the table pages by ISO week. */
export function ChartTablePages() {
  return (
    <Chart.Root
      data={hours}
      config={config}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Household usage per hour, October 2025 to September 2026">
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
