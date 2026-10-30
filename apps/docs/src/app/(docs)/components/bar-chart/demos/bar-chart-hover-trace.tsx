"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The rows and labels below come from the evilcharts example `hover-trace-bar-chart`, commit ecbd6a5.
// Copyright (c) 2026 Gurbinder. Released under the MIT License, whose full text is in
// apps/docs/src/app/(docs)/components/chart/demos/LICENSE-evilcharts.
// The block repeats January to April, so the repeated months carry a trailing space to stay
// distinct categories.
const data = [
  { month: "Jan", desktop: 342 },
  { month: "Feb", desktop: 676 },
  { month: "Mar", desktop: 512 },
  { month: "Apr", desktop: 629 },
  { month: "May", desktop: 458 },
  { month: "Jun", desktop: 781 },
  { month: "Jul", desktop: 394 },
  { month: "Aug", desktop: 924 },
  { month: "Sep", desktop: 647 },
  { month: "Oct", desktop: 532 },
  { month: "Nov", desktop: 803 },
  { month: "Dec", desktop: 271 },
  { month: "Jan ", desktop: 342 },
  { month: "Feb ", desktop: 876 },
  { month: "Mar ", desktop: 512 },
  { month: "Apr ", desktop: 629 },
];

const config = { desktop: { label: "Desktop", color: "chart-1" } } as const satisfies ChartConfig;

export function BarChartHoverTrace() {
  return (
    <BarChart.Root data={data} config={config} xKey="month" aria-label="Visitors by month">
      <BarChart.Headline>
        <BarChart.ActiveValue dataKey="desktop" fallback="max" />
        <span>Visitors</span>
      </BarChart.Headline>
      <BarChart.XAxis />
      <BarChart.Bar dataKey="desktop" />
      <BarChart.Marker dataKey="desktop" at="max">
        <BarChart.ValueLabel />
      </BarChart.Marker>
      <BarChart.ActiveValueLine dataKey="desktop">
        <BarChart.ValueLabel />
      </BarChart.ActiveValueLine>
    </BarChart.Root>
  );
}
