"use client";

import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const PRICE = [62.4, 58.1, 55.7, 54.9, 57.2, 71.8, 98.4, 126.3, 119.5, 101.2, 92.8, 88.6];

/** Twelve hours from 00:00 in Oslo on 17 October 2026, which is UTC+2. */
const data = PRICE.map((price, index) => ({ hour: new Date(Date.UTC(2026, 9, 16, 22 + index)), price }));

const config = {
  price: {
    label: "Spot price",
    color: "chart-1",
    format: { preset: "unit-price", currency: "NOK", minor: true, vat: "included" },
  },
} as const satisfies ChartConfig;

export function LineChartCurveLinear() {
  return (
    <LineChart.Root
      data={data}
      config={config}
      xKey="hour"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Spot price per hour, 17 October">
      <LineChart.Grid />
      <LineChart.YAxis />
      <LineChart.XAxis />
      <LineChart.Line dataKey="price" curve="linear" />
      <LineChart.Tooltip />
      <LineChart.Table />
    </LineChart.Root>
  );
}
