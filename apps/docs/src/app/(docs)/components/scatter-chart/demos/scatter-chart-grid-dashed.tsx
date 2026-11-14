"use client";

import { ScatterChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Invented values. A house's weekly consumption in kWh against the week's mean temperature in °C,
// one point per week from October to March.
const weeks = [
  [9.8, 214],
  [8.1, 236],
  [7.4, 251],
  [6.2, 262],
  [4.9, 289],
  [5.6, 270],
  [3.1, 318],
  [2.4, 330],
  [0.8, 362],
  [-1.2, 401],
  [-3.5, 446],
  [-2.1, 418],
  [-6.8, 509],
  [-4.4, 463],
  [-8.9, 548],
  [-5.2, 472],
  [-2.8, 431],
  [-0.4, 383],
  [1.6, 349],
  [-1.9, 412],
  [0.3, 371],
  [2.9, 322],
  [4.2, 301],
  [6.7, 258],
] as const;

const data = weeks.map(([tempC, kwh]) => ({ tempC, kwh, series: "house" }));

const config = {
  house: {
    label: "Weekly use",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function ScatterChartGridDashed() {
  return (
    <ScatterChart.Root
      data={data}
      config={config}
      xKey="tempC"
      yKey="kwh"
      seriesKey="series"
      xFormat={{ style: "unit", unit: "celsius", maximumFractionDigits: 1 }}
      xLabel="Mean temperature"
      yLabel="Weekly use"
      aria-label="Weekly use against mean temperature, October to March">
      <ScatterChart.Grid variant="dashed" />
      <ScatterChart.XAxis label="Mean temperature (°C)" format={{ maximumFractionDigits: 0 }} />
      <ScatterChart.YAxis format={{ maximumFractionDigits: 0 }} />
      <ScatterChart.Points dataKey="house" />
      <ScatterChart.ActiveDot />
      <ScatterChart.Tooltip />
      <ScatterChart.Table />
    </ScatterChart.Root>
  );
}
