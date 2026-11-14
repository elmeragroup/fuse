"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const KWH = [14.2, 13.8, 15.1, 16.4, 12.9, 11.7, 13.3, 14.8, 15.6, 17.2, 16.1, 13.4, 12.2, 14.0];

/** Fourteen days from 1 October 2026, each starting at midnight in Oslo. */
const days = KWH.map((kwh, index) => ({ day: new Date(Date.UTC(2026, 8, 30 + index, 22)), kwh }));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 1 },
  },
} as const satisfies ChartConfig;

export function ChartBrushWindow() {
  return (
    <Chart.Root
      data={days}
      config={config}
      xKey="day"
      interval="day"
      timeZone="Europe/Oslo"
      aria-label="Usage per day, 1 to 14 October 2026">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Tooltip />
      <Chart.Brush>
        <Chart.BrushPreview>
          <Chart.Bar dataKey="kwh" />
        </Chart.BrushPreview>
      </Chart.Brush>
      <Chart.Table />
    </Chart.Root>
  );
}
