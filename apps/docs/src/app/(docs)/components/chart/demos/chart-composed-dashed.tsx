"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The rows and labels below come from the evilcharts example `ex-dashed-stroke-composed-chart`, commit ecbd6a5.
// Copyright (c) 2026 Gurbinder. Released under the MIT License, whose full text is in
// apps/docs/src/app/(docs)/components/chart/demos/LICENSE-evilcharts.
const data = [
  { month: "January", revenue: 4200, profit: 1800 },
  { month: "February", revenue: 5800, profit: 2400 },
  { month: "March", revenue: 4100, profit: 1600 },
  { month: "April", revenue: 6200, profit: 2800 },
  { month: "May", revenue: 5400, profit: 2200 },
  { month: "June", revenue: 7800, profit: 3400 },
  { month: "July", revenue: 6100, profit: 2600 },
  { month: "August", revenue: 8200, profit: 3800 },
  { month: "September", revenue: 5900, profit: 2500 },
  { month: "October", revenue: 6800, profit: 3000 },
  { month: "November", revenue: 7200, profit: 3200 },
  { month: "December", revenue: 9100, profit: 4200 },
];

const config = {
  revenue: { label: "Revenue", color: "chart-1" },
  profit: { label: "Profit", color: "chart-2" },
} as const satisfies ChartConfig;

export function ChartComposedDashed() {
  return (
    <Chart.Root
      data={data}
      config={config}
      xKey="month"
      aria-label="Revenue and profit by month, a dashed line">
      <Chart.Grid />
      <Chart.XAxis />
      <Chart.Bar dataKey="revenue" />
      <Chart.Line dataKey="profit" variant="dashed" />
      <Chart.Legend />
      <Chart.Tooltip />
    </Chart.Root>
  );
}
