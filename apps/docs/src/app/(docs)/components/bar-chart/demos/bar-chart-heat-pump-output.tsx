"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// An air-to-water heat pump's heating output at the outdoor temperatures it is rated at, which lie
// unevenly apart.
const data = [
  { outdoor: -15, output: 4.1 },
  { outdoor: -7, output: 5.2 },
  { outdoor: 2, output: 6.3 },
  { outdoor: 7, output: 7.8 },
  { outdoor: 12, output: 8.6 },
];

const config = {
  output: {
    label: "Heating output",
    color: "chart-1",
    format: { preset: "power", unit: "kW", maximumFractionDigits: 1 },
  },
} as const satisfies ChartConfig;

export function BarChartHeatPumpOutput() {
  return (
    <BarChart.Root
      data={data}
      config={config}
      xKey="outdoor"
      xScale="linear"
      xFormat={{ style: "unit", unit: "celsius" }}
      xLabel="Outdoor temperature"
      aria-label="Heat pump output by outdoor temperature">
      <BarChart.Grid variant="dashed" />
      <BarChart.YAxis />
      <BarChart.XAxis label="Outdoor temperature" />
      <BarChart.Bar dataKey="output" />
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
