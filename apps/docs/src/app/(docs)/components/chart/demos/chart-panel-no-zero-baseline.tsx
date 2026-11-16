"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** Twelve hours from midnight in Oslo on 17 October 2026, which is UTC+2. The prices are illustrative. */
const hours = [
  [0.42, 96],
  [0.38, 92],
  [0.35, 90],
  [0.34, 91],
  [0.36, 95],
  [0.51, 108],
  [0.88, 131],
  [1.24, 148],
  [1.02, 139],
  [0.74, 121],
  [0.66, 114],
  [0.61, 110],
].map(([kwh, price], index) => ({ start: new Date(Date.UTC(2026, 9, 16, 22 + index)), kwh, price }));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
  price: {
    label: "Spot price",
    color: "chart-2",
    format: { preset: "unit-price", currency: "NOK", minor: true, vat: "excluded" },
  },
} as const satisfies ChartConfig;

export function ChartPanelNoZeroBaseline() {
  return (
    <Chart.Root
      data={hours}
      config={config}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Usage and illustrative spot price per hour, 17 October">
      <Chart.Panel series={["kwh"]}>
        <Chart.Grid />
        <Chart.YAxis />
        <Chart.Bar dataKey="kwh" />
      </Chart.Panel>
      <Chart.Panel series={["price"]} yBaseline="none">
        <Chart.Grid />
        <Chart.YAxis />
        <Chart.Line dataKey="price" />
        <Chart.XAxis />
      </Chart.Panel>
      <Chart.Tooltip />
      <Chart.Legend />
      <Chart.Table />
    </Chart.Root>
  );
}
