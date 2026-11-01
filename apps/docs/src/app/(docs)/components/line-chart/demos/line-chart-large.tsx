"use client";

import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

import { HOURLY_YEAR_KWH, HOURLY_YEAR_START } from "../../chart/demos/data/hourly-year";

const start = Date.parse(HOURLY_YEAR_START);
const hours = HOURLY_YEAR_KWH.map((kwh, index) => ({ hour: new Date(start + index * 3_600_000), kwh }));

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

/** A year of hourly readings draws the M4 vertices of each pixel column, so every spike stays. */
export function LineChartLarge() {
  return (
    <LineChart.Root
      data={hours}
      config={config}
      xKey="hour"
      xScale="point"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Hourly consumption over a year">
      <LineChart.Grid />
      <LineChart.YAxis />
      <LineChart.XAxis />
      <LineChart.Line dataKey="kwh" curve="linear" />
      <LineChart.Crosshair />
      <LineChart.Tooltip />
    </LineChart.Root>
  );
}
