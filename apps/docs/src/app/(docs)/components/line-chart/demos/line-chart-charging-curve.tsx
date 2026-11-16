"use client";

import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// An EV's charging power at a fast charger by state of charge, read at uneven steps: often where the
// power changes fast, seldom where it holds.
const data = [
  { soc: 0, power: 95 },
  { soc: 5, power: 148 },
  { soc: 10, power: 172 },
  { soc: 20, power: 168 },
  { soc: 35, power: 151 },
  { soc: 50, power: 122 },
  { soc: 65, power: 94 },
  { soc: 80, power: 61 },
  { soc: 90, power: 32 },
  { soc: 100, power: 7 },
];

const config = {
  power: {
    label: "Charging power",
    color: "chart-1",
    format: { preset: "power", unit: "kW", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function LineChartChargingCurve() {
  return (
    <LineChart.Root
      data={data}
      config={config}
      xKey="soc"
      xScale="linear"
      xFormat={{ style: "unit", unit: "percent" }}
      xLabel="State of charge"
      aria-label="Charging power by state of charge">
      <LineChart.Grid orientation="both" />
      <LineChart.YAxis />
      <LineChart.XAxis label="State of charge" />
      <LineChart.Line dataKey="power" />
      <LineChart.Dots dataKey="power" variant="ring" />
      <LineChart.Crosshair />
      <LineChart.ActiveDot dataKey="power" />
      <LineChart.Tooltip />
    </LineChart.Root>
  );
}
