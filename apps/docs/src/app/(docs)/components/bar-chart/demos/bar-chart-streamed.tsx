"use client";

import { Suspense, use, useEffect } from "react";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const months = [
  { month: "Jan", grid: 1820, solar: 40 },
  { month: "Feb", grid: 1640, solar: 110 },
  { month: "Mar", grid: 1390, solar: 260 },
  { month: "Apr", grid: 980, solar: 420 },
  { month: "May", grid: 720, solar: 560 },
  { month: "Jun", grid: 540, solar: 610 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const config = {
  grid: { label: "From the grid", color: "chart-1", stack: "supply", format: energy },
  solar: { label: "From solar panels", color: "chart-2", stack: "supply", format: energy },
} as const satisfies ChartConfig;

/**
 * Stands in for readings the browser loads again once the chart is on screen. The server already
 * holds them, so it renders the solar series at once and has nothing to wait for.
 */
const solarReadings = "window" in globalThis ? Promise.withResolvers<void>() : null;

/** The solar series, which renders once its readings have arrived. */
function SolarBar() {
  if (solarReadings !== null) use(solarReadings.promise);
  return <BarChart.Bar dataKey="solar" />;
}

export function BarChartStreamed() {
  // The readings arrive 400 ms after the chart has mounted, so the solar series always hydrates
  // after the rest of the chart.
  useEffect(() => {
    const timer = setTimeout(() => solarReadings?.resolve(), 400);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return (
    <BarChart.Root data={months} config={config} xKey="month" aria-label="Electricity supply per month">
      <BarChart.Grid />
      <BarChart.YAxis />
      <BarChart.XAxis />
      <BarChart.Bar dataKey="grid" />
      <Suspense fallback={null}>
        <SolarBar />
      </Suspense>
      <BarChart.Tooltip />
      <BarChart.Legend />
      <BarChart.Table />
    </BarChart.Root>
  );
}
