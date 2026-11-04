"use client";

import { ScatterChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Invented values, made by a fixed generator so every render draws the same points. 100,000
// hours of two office buildings' consumption in kWh against the hour's outdoor temperature in °C.
function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

const next = generator(2026);
/** A bell-shaped draw from -1 to 1, the mean of three uniform draws. */
const bell = () => (next() + next() + next()) / 1.5 - 1;
const data = Array.from({ length: 100_000 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const series = index % 2 === 0 ? "north" : "south";
  // A seasonal swing over the year's 8,760 hours, a daily one, and the weather on top.
  const tempC =
    Math.round(
      (5 +
        10 * Math.sin((2 * Math.PI * (hour - 2_400)) / 8_760) +
        3 * Math.sin((2 * Math.PI * hour) / 24) +
        4 * bell()) *
        10
    ) / 10;
  const base = series === "north" ? 380 : 290;
  // Heating falls as it warms, and cooling picks up above 18 °C.
  const kwh = Math.round(base - 9 * tempC + (tempC > 18 ? (tempC - 18) * 16 : 0) + 45 * bell());
  return { tempC, kwh, series };
});

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const config = {
  north: { label: "North building", color: "chart-1", format: energy },
  south: { label: "South building", color: "chart-3", format: energy },
} as const satisfies ChartConfig;

export function ScatterChartLarge() {
  return (
    <ScatterChart.Root
      data={data}
      config={config}
      xKey="tempC"
      yKey="kwh"
      seriesKey="series"
      xFormat={{ style: "unit", unit: "celsius", maximumFractionDigits: 1 }}
      xLabel="Outdoor temperature"
      yLabel="Hourly use"
      aria-label="Hourly use against outdoor temperature, 100,000 hours in two buildings"
      style={{ "--chart-plot-height": "18rem" }}>
      <ScatterChart.Grid />
      <ScatterChart.XAxis format={{ maximumFractionDigits: 0 }} />
      <ScatterChart.YAxis format={{ maximumFractionDigits: 0 }} />
      <ScatterChart.Points dataKey="north" size="sm" variant="quiet" />
      <ScatterChart.Points dataKey="south" size="sm" variant="quiet" />
      <ScatterChart.ActiveDot />
      <ScatterChart.Tooltip />
      <ScatterChart.Legend />
      <ScatterChart.Table />
    </ScatterChart.Root>
  );
}
