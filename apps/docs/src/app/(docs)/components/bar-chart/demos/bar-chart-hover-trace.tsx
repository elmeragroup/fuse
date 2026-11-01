"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** The first instant of an Oslo month, which starts in summer time from April to October. */
function osloMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, month >= 4 && month <= 10 ? -2 : -1));
}

// Sixteen months of one household's consumption, from January 2025 to April 2026.
const data = [
  { month: osloMonth(2025, 1), kwh: 2412 },
  { month: osloMonth(2025, 2), kwh: 2168 },
  { month: osloMonth(2025, 3), kwh: 1893 },
  { month: osloMonth(2025, 4), kwh: 1447 },
  { month: osloMonth(2025, 5), kwh: 1062 },
  { month: osloMonth(2025, 6), kwh: 806 },
  { month: osloMonth(2025, 7), kwh: 731 },
  { month: osloMonth(2025, 8), kwh: 788 },
  { month: osloMonth(2025, 9), kwh: 1004 },
  { month: osloMonth(2025, 10), kwh: 1458 },
  { month: osloMonth(2025, 11), kwh: 1917 },
  { month: osloMonth(2025, 12), kwh: 2296 },
  { month: osloMonth(2026, 1), kwh: 2587 },
  { month: osloMonth(2026, 2), kwh: 2301 },
  { month: osloMonth(2026, 3), kwh: 1946 },
  { month: osloMonth(2026, 4), kwh: 1388 },
];

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function BarChartHoverTrace() {
  return (
    <BarChart.Root
      data={data}
      config={config}
      xKey="month"
      interval="month"
      timeZone="Europe/Oslo"
      aria-label="Consumption per month, January 2025 to April 2026">
      <BarChart.Headline>
        <BarChart.ActiveValue dataKey="kwh" fallback="max" />
        <span>Consumption</span>
      </BarChart.Headline>
      <BarChart.XAxis />
      <BarChart.Bar dataKey="kwh" />
      <BarChart.Marker dataKey="kwh" at="max">
        <BarChart.ValueLabel />
      </BarChart.Marker>
      <BarChart.ActiveValueLine dataKey="kwh">
        <BarChart.ValueLabel />
      </BarChart.ActiveValueLine>
      <BarChart.Table />
    </BarChart.Root>
  );
}
