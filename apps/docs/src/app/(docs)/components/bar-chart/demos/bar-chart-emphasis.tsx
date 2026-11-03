"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const quarters = [
  { quarter: "Q1", grid: 2140, energy: 3120 },
  { quarter: "Q2", grid: 1380, energy: 1610 },
  { quarter: "Q3", grid: 1210, energy: 1350 },
  { quarter: "Q4", grid: 2010, energy: 2990 },
];

const kr = { style: "currency", currency: "NOK", maximumFractionDigits: 0 } as const;

const config = {
  grid: { label: "Grid rent", color: "chart-1", stack: "cost", format: kr },
  energy: { label: "Energy", color: "chart-2", stack: "cost", format: kr },
} as const satisfies ChartConfig;

/** Emphasis on the highest stack total, which compares the whole column, not one segment. */
export function BarChartEmphasis() {
  return (
    <BarChart.Root data={quarters} config={config} xKey="quarter" aria-label="Electricity cost per quarter">
      <BarChart.Grid />
      <BarChart.YAxis />
      <BarChart.XAxis />
      <BarChart.Bar dataKey="grid" emphasis="max" />
      <BarChart.Bar dataKey="energy" emphasis="max" />
      <BarChart.Tooltip />
      <BarChart.Legend />
      <BarChart.Table />
    </BarChart.Root>
  );
}
