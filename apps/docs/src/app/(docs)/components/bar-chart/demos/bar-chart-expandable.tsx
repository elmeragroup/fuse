"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const days = [
  { day: "Mon", kwh: 14.2 },
  { day: "Tue", kwh: 12.8 },
  { day: "Wed", kwh: 15.6 },
  { day: "Thu", kwh: 13.1 },
  { day: "Fri", kwh: 16.9 },
  { day: "Sat", kwh: 21.4 },
  { day: "Sun", kwh: 19.7 },
];

const config = {
  kwh: { label: "Consumption", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
} as const satisfies ChartConfig;

export function BarChartExpandable() {
  return (
    <BarChart.Root data={days} config={config} xKey="day" aria-label="Consumption per weekday">
      <BarChart.XAxis />
      <BarChart.Bar dataKey="kwh" variant="expandable" />
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
