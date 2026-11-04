"use client";

import { ScatterChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Invented values. A house's daily consumption in kWh against the day's mean temperature in °C,
// three weeks across a cold snap, beside the household's daily budget of 60 kWh.
const days = [
  [4.2, 41],
  [3.1, 44],
  [2.5, 47],
  [1.4, 49],
  [0.6, 53],
  [-0.8, 56],
  [-2.3, 61],
  [-4.1, 66],
  [-5.6, 71],
  [-7.2, 75],
  [-6.4, 73],
  [-3.8, 64],
  [-1.5, 58],
  [0.2, 52],
  [1.8, 48],
  [2.9, 45],
  [-0.3, 54],
  [-2.9, 62],
  [3.6, 43],
  [5.1, 39],
  [6.0, 36],
] as const;

const data = days.map(([tempC, kwh]) => ({ tempC, kwh, series: "house" }));

const config = {
  house: {
    label: "Daily use",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function ScatterChartReferenceLines() {
  return (
    <ScatterChart.Root
      data={data}
      config={config}
      xKey="tempC"
      yKey="kwh"
      seriesKey="series"
      xFormat={{ style: "unit", unit: "celsius", maximumFractionDigits: 1 }}
      valueFormat={{ preset: "energy", unit: "kWh", maximumFractionDigits: 0 }}
      xLabel="Mean temperature"
      yLabel="Daily use"
      aria-label="Daily use against mean temperature over a cold snap">
      <ScatterChart.Grid />
      <ScatterChart.XAxis format={{ maximumFractionDigits: 0 }} />
      <ScatterChart.YAxis />
      <ScatterChart.ReferenceLine x={0} label="Freezing" variant="dashed" />
      <ScatterChart.ReferenceLine y={60} label="Budget {value}" tone="error" />
      <ScatterChart.Points dataKey="house" />
      <ScatterChart.ActiveDot />
      <ScatterChart.Tooltip />
    </ScatterChart.Root>
  );
}
