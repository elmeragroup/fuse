"use client";

import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const THIS_YEAR = [412, 388, 351, 296, 241, 198, 187, 203, 247, 318, 371, 405];
const LAST_YEAR = [436, 401, 372, 310, 259, 207, 191, 214, 266, 335, 392, 428];
const TARGET = [400, 380, 340, 290, 240, 200, 190, 200, 240, 300, 360, 400];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const data = MONTHS.map((month, index) => ({
  month,
  thisYear: THIS_YEAR[index] ?? null,
  lastYear: LAST_YEAR[index] ?? null,
  target: TARGET[index] ?? null,
}));

const kwh = { preset: "energy", unit: "kWh" } as const;

const config = {
  thisYear: { label: "This year", color: "chart-1", format: kwh },
  target: { label: "Target", color: "chart-2", format: kwh },
  lastYear: { label: "Last year", color: "chart-3", format: kwh },
} as const satisfies ChartConfig;

export function LineChartVariants() {
  return (
    <LineChart.Root
      data={data}
      config={config}
      xKey="month"
      xScale="point"
      aria-label="Monthly consumption against target">
      <LineChart.Grid />
      <LineChart.YAxis />
      <LineChart.XAxis />
      <LineChart.Line dataKey="lastYear" variant="quiet" />
      <LineChart.Line dataKey="target" variant="dashed" curve="linear" />
      <LineChart.Line dataKey="thisYear" />
      <LineChart.Crosshair />
      <LineChart.ActiveDot dataKey="thisYear" />
      <LineChart.Tooltip />
      <LineChart.Legend />
    </LineChart.Root>
  );
}
