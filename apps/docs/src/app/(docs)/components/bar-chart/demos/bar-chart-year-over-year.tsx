"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const months = [
  { month: "Jan", thisYear: 1820, lastYear: 1950 },
  { month: "Feb", thisYear: 1640, lastYear: 1710 },
  { month: "Mar", thisYear: 1390, lastYear: 1480 },
  { month: "Apr", thisYear: 980, lastYear: 1060 },
  { month: "May", thisYear: 720, lastYear: 760 },
  { month: "Jun", thisYear: 540, lastYear: 590 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const config = {
  thisYear: { label: "This year", color: "chart-1", format: energy },
  lastYear: { label: "Last year", color: "chart-2", format: energy, variant: "hatched" },
} as const satisfies ChartConfig;

export function BarChartYearOverYear() {
  return (
    <BarChart.Root data={months} config={config} xKey="month" aria-label="Monthly usage against last year">
      <BarChart.Grid />
      <BarChart.YAxis />
      <BarChart.XAxis />
      <BarChart.BarGroup series={["thisYear", "lastYear"]}>
        <BarChart.Bar dataKey="thisYear" />
        <BarChart.Bar dataKey="lastYear" />
      </BarChart.BarGroup>
      <BarChart.Crosshair variant="band" />
      <BarChart.Legend />
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
