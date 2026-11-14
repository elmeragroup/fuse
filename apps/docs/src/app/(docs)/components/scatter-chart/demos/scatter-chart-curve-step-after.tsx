"use client";

import { ScatterChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Invented values. An electric car's charging power in kW against its battery level in %, sampled
// where the power changes, so the samples sit unevenly along the x axis.
const samples = [
  [3, 96],
  [8, 148],
  [12, 151],
  [20, 150],
  [31, 146],
  [42, 139],
  [50, 128],
  [55, 117],
  [61, 103],
  [68, 88],
  [74, 72],
  [80, 55],
  [86, 38],
  [90, 27],
  [95, 14],
  [100, 4],
] as const;

const data = samples.map(([battery, kw]) => ({ battery, kw, series: "charge" }));

const config = {
  charge: {
    label: "Charging power",
    color: "chart-2",
    format: { preset: "power", unit: "kW", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function ScatterChartCurveStepAfter() {
  return (
    <ScatterChart.Root
      data={data}
      config={config}
      xKey="battery"
      yKey="kw"
      seriesKey="series"
      xFormat={{ style: "unit", unit: "percent", maximumFractionDigits: 0 }}
      xLabel="Battery"
      yLabel="Charging power"
      aria-label="Charging power against battery level">
      <ScatterChart.Grid />
      <ScatterChart.XAxis />
      <ScatterChart.YAxis />
      <ScatterChart.Line dataKey="charge" curve="step-after" />
      <ScatterChart.Tooltip />
      <ScatterChart.Table />
    </ScatterChart.Root>
  );
}
