"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** Invented spot prices for the twelve quarters from 06:00 in Oslo on 17 October 2026, typed by hand. */
const rows = [0.92, 0.98, 1.06, 1.14, 1.31, 1.42, 1.48, 1.39, 1.22, 1.11, 1.04, 0.97].map((price, index) => ({
  start: new Date(Date.UTC(2026, 9, 17, 4, index * 15)),
  price,
}));

const config = {
  price: {
    label: "Spot price",
    color: "chart-1",
    format: { preset: "unit-price", currency: "NOK", vat: "excluded" },
  },
} as const satisfies ChartConfig;

export function ChartIntervalQuarterHour() {
  return (
    <Chart.Root
      data={rows}
      config={config}
      xKey="start"
      interval="quarter-hour"
      timeZone="Europe/Oslo"
      aria-label="Spot price per quarter hour, 06:00 to 09:00 on 17 October">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="price" />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
