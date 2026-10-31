"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The rows and labels below come from the evilcharts example `ex-percent-type-bar-chart`, commit ecbd6a5.
// Copyright (c) 2026 Gurbinder. Released under the MIT License, whose full text is in
// apps/docs/src/app/(docs)/components/chart/demos/LICENSE-evilcharts.
const data = [
  { month: "Jan", desktop: 342, mobile: 184 },
  { month: "Feb", desktop: 876, mobile: 491 },
  { month: "Mar", desktop: 512, mobile: 290 },
  { month: "Apr", desktop: 629, mobile: 391 },
  { month: "May", desktop: 458, mobile: 309 },
  { month: "Jun", desktop: 781, mobile: 449 },
  { month: "Jul", desktop: 394, mobile: 234 },
  { month: "Aug", desktop: 925, mobile: 557 },
  { month: "Sep", desktop: 647, mobile: 367 },
  { month: "Oct", desktop: 532, mobile: 357 },
  { month: "Nov", desktop: 803, mobile: 515 },
  { month: "Dec", desktop: 271, mobile: 149 },
];

const config = {
  desktop: { label: "Desktop", color: "chart-1", stack: "visitors" },
  mobile: { label: "Mobile", color: "chart-2", stack: "visitors" },
} as const satisfies ChartConfig;

export function BarChartPercent() {
  return (
    <BarChart.Root
      data={data}
      config={config}
      xKey="month"
      stackOffset="expand"
      aria-label="Share of visitors by month">
      <BarChart.Grid variant="dashed" />
      <BarChart.XAxis />
      <BarChart.Bar dataKey="desktop" />
      <BarChart.Bar dataKey="mobile" />
      <BarChart.Legend />
      <BarChart.Tooltip />
    </BarChart.Root>
  );
}
