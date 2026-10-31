"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The rows and labels below come from the evilcharts example `isometric-bar-chart`, commit ecbd6a5.
// Copyright (c) 2026 Gurbinder. Released under the MIT License, whose full text is in
// apps/docs/src/app/(docs)/components/chart/demos/LICENSE-evilcharts.
const data = [
  { month: "Jan", revenue: 28 },
  { month: "Feb", revenue: 34 },
  { month: "Mar", revenue: 22 },
  { month: "Apr", revenue: 41 },
  { month: "May", revenue: 47 },
  { month: "Jun", revenue: 31 },
  { month: "Jul", revenue: 38 },
];

const config = {
  revenue: {
    label: "Revenue",
    color: "chart-1",
    format: { style: "currency", currency: "USD", notation: "compact" },
    variant: "isometric",
  },
} as const satisfies ChartConfig;

export function BarChartIsometric() {
  return (
    // The example's chart fills what its preview panel leaves below the header. The panel is 16rem
    // tall below the 640px breakpoint and 22.5rem from it, and the header, padding, axis and the 30px
    // top margin for the extrusion leave a plot of 55px on a phone and 175px from the breakpoint.
    <BarChart.Root
      data={data}
      config={config}
      xKey="month"
      className="sm:[--chart-plot-height:175px] [--chart-plot-height:55px]"
      aria-label="Revenue by month">
      <BarChart.XAxis />
      <BarChart.Bar dataKey="revenue" emphasis="max" emphasisLabel="peak" />
      <BarChart.Tooltip />
    </BarChart.Root>
  );
}
