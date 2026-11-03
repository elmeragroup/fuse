"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** The first instant of an Oslo month, which starts in summer time from April to October. */
function osloMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, month >= 4 && month <= 10 ? -2 : -1));
}

// Two years of one household's consumption, 2024 and 2025.
const data = [
  { month: osloMonth(2024, 1), kwh: 2538 },
  { month: osloMonth(2024, 2), kwh: 2271 },
  { month: osloMonth(2024, 3), kwh: 1962 },
  { month: osloMonth(2024, 4), kwh: 1406 },
  { month: osloMonth(2024, 5), kwh: 1041 },
  { month: osloMonth(2024, 6), kwh: 784 },
  { month: osloMonth(2024, 7), kwh: 702 },
  { month: osloMonth(2024, 8), kwh: 769 },
  { month: osloMonth(2024, 9), kwh: 987 },
  { month: osloMonth(2024, 10), kwh: 1503 },
  { month: osloMonth(2024, 11), kwh: 1986 },
  { month: osloMonth(2024, 12), kwh: 2344 },
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
];

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function BarChartMonospace() {
  return (
    // The chart's text inherits the family, so a wrapper sets the monospace face.
    <div className="w-full font-mono">
      <BarChart.Root
        data={data}
        config={config}
        xKey="month"
        interval="month"
        timeZone="Europe/Oslo"
        aria-label="Consumption per month over two years">
        <BarChart.XAxis />
        <BarChart.Bar dataKey="kwh" />
        <BarChart.Tooltip />
        <BarChart.Table />
      </BarChart.Root>
    </div>
  );
}
