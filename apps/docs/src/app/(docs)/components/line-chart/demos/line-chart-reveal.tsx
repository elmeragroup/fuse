"use client";

import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const KWH = [
  0.42, 0.38, 0.35, 0.33, 0.34, 0.41, 0.82, 1.36, 1.12, 0.86, 0.74, 0.69, 0.71, 0.66, 0.63, 0.77, 1.18, 1.62,
  1.84, 1.51, 1.22, 0.97, 0.71, 0.52,
];

/** One row per hour from 00:00 in Oslo on 16 October 2026, which is UTC+2. */
const hours = KWH.map((kwh, index) => ({ hour: new Date(Date.UTC(2026, 9, 15, 22 + index)), kwh }));

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

export function LineChartReveal() {
  return (
    <LineChart.Root
      data={hours}
      config={config}
      xKey="hour"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Consumption per hour">
      <LineChart.Headline>
        <LineChart.ActiveValue dataKey="kwh" fallback="max" />
      </LineChart.Headline>
      <LineChart.XAxis />
      <LineChart.Reveal>
        <LineChart.Area dataKey="kwh" />
        <LineChart.Line dataKey="kwh" />
      </LineChart.Reveal>
      <LineChart.Crosshair variant="line" />
      <LineChart.ActiveDot dataKey="kwh" />
    </LineChart.Root>
  );
}
