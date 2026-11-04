"use client";

import { ScatterChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Invented values. Daily consumption in kWh against the day's mean temperature in °C for three
// homes, and the house's days last year as a pale reference.
const days = {
  cabin: [
    [-6, 21],
    [-2, 17],
    [1, 14],
    [4, 11],
    [8, 8],
    [12, 6],
  ],
  apartment: [
    [-7, 34],
    [-3, 29],
    [0, 26],
    [3, 23],
    [7, 19],
    [11, 16],
  ],
  house: [
    [-8, 78],
    [-4, 66],
    [-1, 58],
    [2, 51],
    [6, 42],
    [10, 33],
  ],
  houseLastYear: [
    [-9, 84],
    [-5, 71],
    [-2, 62],
    [1, 56],
    [5, 47],
    [9, 37],
    [13, 29],
  ],
} as const;

const data = Object.entries(days).flatMap(([series, points]) =>
  points.map(([tempC, kwh]) => ({ tempC, kwh, series }))
);

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const config = {
  cabin: { label: "Cabin", color: "chart-3", format: energy },
  apartment: { label: "Apartment", color: "chart-2", format: energy },
  house: { label: "House", color: "chart-1", format: energy },
  houseLastYear: { label: "House, last year", color: "chart-1", format: energy },
} as const satisfies ChartConfig;

export function ScatterChartSizes() {
  return (
    <ScatterChart.Root
      data={data}
      config={config}
      xKey="tempC"
      yKey="kwh"
      seriesKey="series"
      xFormat={{ style: "unit", unit: "celsius" }}
      xLabel="Mean temperature"
      yLabel="Daily use"
      aria-label="Daily use against mean temperature for a cabin, an apartment and a house">
      <ScatterChart.Grid />
      <ScatterChart.XAxis />
      <ScatterChart.YAxis />
      <ScatterChart.Points dataKey="houseLastYear" size="md" variant="quiet" />
      <ScatterChart.Points dataKey="cabin" size="sm" />
      <ScatterChart.Points dataKey="apartment" size="md" />
      <ScatterChart.Points dataKey="house" size="lg" />
      <ScatterChart.ActiveDot />
      <ScatterChart.Tooltip />
      <ScatterChart.Legend />
    </ScatterChart.Root>
  );
}
