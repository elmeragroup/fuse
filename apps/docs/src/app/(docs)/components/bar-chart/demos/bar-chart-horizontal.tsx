"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The rows and labels below come from the evilcharts example `ex-horizontal-layout-bar-chart`, commit ecbd6a5.
// Copyright (c) 2026 Gurbinder. Released under the MIT License, whose full text is in
// apps/docs/src/app/(docs)/components/chart/demos/LICENSE-evilcharts.
const data = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 173 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
];

const config = { desktop: { label: "Desktop", color: "chart-1" } } as const satisfies ChartConfig;

export function BarChartHorizontal() {
  return (
    <BarChart.Root
      data={data}
      config={config}
      xKey="month"
      orientation="horizontal"
      aria-label="Visitors by month">
      <BarChart.Grid />
      <BarChart.XAxis />
      <BarChart.YAxis />
      <BarChart.Bar dataKey="desktop" />
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
