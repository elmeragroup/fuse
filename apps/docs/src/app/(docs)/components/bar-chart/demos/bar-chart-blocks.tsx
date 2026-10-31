"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The rows and labels below come from the evilcharts example `grid-bar-chart`, commit ecbd6a5.
// Copyright (c) 2026 Gurbinder. Released under the MIT License, whose full text is in
// apps/docs/src/app/(docs)/components/chart/demos/LICENSE-evilcharts.
const data = [
  { month: "Jan", desktop: 186 },
  { month: "Feb", desktop: 305 },
  { month: "Mar", desktop: 237 },
  { month: "Apr", desktop: 273 },
  { month: "May", desktop: 209 },
  { month: "Jun", desktop: 346 },
  { month: "Jul", desktop: 181 },
  { month: "Aug", desktop: 392 },
  { month: "Sep", desktop: 298 },
  { month: "Oct", desktop: 215 },
  { month: "Nov", desktop: 327 },
  { month: "Dec", desktop: 162 },
];

const config = {
  desktop: { label: "Desktop", color: "chart-1", variant: "blocks" },
} as const satisfies ChartConfig;

export function BarChartBlocks() {
  return (
    // The example's chart fills what its preview panel leaves below the header. The panel is 16rem
    // tall below the 640px breakpoint and 22.5rem from it, and the header, padding and axis take
    // 165px, so the plot is 91px on a phone and 195px from the breakpoint.
    <BarChart.Root
      data={data}
      config={config}
      xKey="month"
      className="sm:[--chart-plot-height:195px] [--chart-plot-height:91px]"
      aria-label="Visitors by month">
      <BarChart.XAxis />
      <BarChart.Bar dataKey="desktop" />
      <BarChart.Tooltip />
    </BarChart.Root>
  );
}
