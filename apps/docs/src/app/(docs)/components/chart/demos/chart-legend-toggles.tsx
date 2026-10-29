"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** Twelve hours from midnight in Oslo on 17 October 2026, which is UTC+2. */
const hours = [
  [0.42, 0.11],
  [0.38, 0.1],
  [0.35, 0.1],
  [0.34, 0.09],
  [0.36, 0.1],
  [0.51, 0.18],
  [0.88, 0.31],
  [1.24, 0.42],
  [1.02, 0.35],
  [0.74, 0.22],
  [0.66, 0.2],
  [0.61, 0.17],
].map(([house, car], index) => ({ start: new Date(Date.UTC(2026, 9, 16, 22 + index)), house, car }));

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 2 } as const;

const config = {
  house: { label: "House", color: "chart-1", stack: "use", format: energy },
  car: { label: "Car", color: "chart-2", stack: "use", format: energy },
} as const satisfies ChartConfig;

export function ChartSeriesToggles() {
  return (
    <Chart.Root
      data={hours}
      config={config}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Usage per hour by load">
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="house" />
      <Chart.Bar dataKey="car" />
      <Chart.LegendToggleGroup />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
