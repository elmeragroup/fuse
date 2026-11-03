"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const KWH = [
  0.42, 0.38, 0.35, 0.34, 0.36, 0.51, 0.88, 1.24, 1.02, 0.74, 0.66, 0.61, 0.58, 0.55, 0.6, 0.72, 1.05, 1.38,
  1.46, 1.21, 0.97, 0.81, 0.63, 0.49,
];

/** The 24 hours of 17 October 2026 in Oslo, which is UTC+2. */
const hours = KWH.map((kwh, index) => ({ start: new Date(Date.UTC(2026, 9, 16, 22 + index)), kwh }));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

export function BarChartDatePill() {
  return (
    <BarChart.Root
      data={hours}
      config={config}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Usage per hour, 17 October">
      <BarChart.Grid />
      <BarChart.YAxis />
      <BarChart.XAxis />
      <BarChart.Bar dataKey="kwh" />
      <BarChart.Crosshair variant="line">
        <BarChart.SlotLabel />
      </BarChart.Crosshair>
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
