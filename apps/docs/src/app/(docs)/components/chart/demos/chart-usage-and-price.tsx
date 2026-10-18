"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const KWH = [0.42, 0.38, 0.35, 0.34, 0.36, 0.51, 0.88, 1.24, 1.02, 0.74, 0.66, 0.61];
const ORE = [61.2, 58.4, 55.9, 54.1, 57.3, 72.8, 104.5, 131.9, 118.2, 96.4, 88.7, 84.1];

/** Twelve hours from midnight in Oslo on 17 October 2026, which is UTC+2. */
const hours = KWH.map((kwh, index) => ({
  start: new Date(Date.UTC(2026, 9, 16, 22 + index)),
  kwh,
  price: ORE[index] ?? null,
}));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
  price: {
    label: "Spot price",
    color: "chart-2",
    format: { preset: "unit-price", currency: "NOK", minor: true, vat: "included" },
  },
} as const satisfies ChartConfig;

export function ChartUsageAndPrice() {
  return (
    <Chart.Root
      data={hours}
      config={config}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      now={new Date(Date.UTC(2026, 9, 17, 5, 30))}
      aria-label="Usage and spot price, 17 October">
      <Chart.Panel series={["kwh"]}>
        <Chart.Grid />
        <Chart.YAxis />
        <Chart.Bar dataKey="kwh" emphasis="now" />
        <Chart.Crosshair variant="band" />
      </Chart.Panel>
      <Chart.Panel series={["price"]} yInclude={[150]}>
        <Chart.Grid />
        <Chart.YAxis />
        <Chart.XAxis />
        <Chart.Glow>
          <Chart.Line dataKey="price" curve="step-after" />
        </Chart.Glow>
        <Chart.ReferenceLine y={150} label="Price cap {value}" variant="dashed" />
        <Chart.Crosshair />
      </Chart.Panel>
      <Chart.Legend />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
