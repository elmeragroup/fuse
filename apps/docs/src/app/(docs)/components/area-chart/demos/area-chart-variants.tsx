"use client";

import { AreaChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The rows and labels below come from the evilcharts example `ex-gradient-area-variant-area-chart`, commit ecbd6a5.
// Copyright (c) 2026 Gurbinder. Released under the MIT License, whose full text is in
// apps/docs/src/app/(docs)/components/chart/demos/LICENSE-evilcharts.
const data = [
  { month: "Jan", desktop: 342 },
  { month: "Feb", desktop: 876 },
  { month: "Mar", desktop: 512 },
  { month: "Apr", desktop: 629 },
  { month: "May", desktop: 458 },
  { month: "Jun", desktop: 781 },
  { month: "Jul", desktop: 394 },
  { month: "Aug", desktop: 925 },
  { month: "Sep", desktop: 647 },
  { month: "Oct", desktop: 532 },
  { month: "Nov", desktop: 803 },
  { month: "Dec", desktop: 271 },
];

const config = { desktop: { label: "Desktop", color: "chart-1" } } as const satisfies ChartConfig;

const VARIANTS = ["gradient", "gradient-reverse", "solid", "dotted", "lines", "hatched"] as const;

/** Each fill look of `Chart.Area`, with a Line drawing its edge. */
export function AreaChartVariants() {
  return (
    <div className="sm:grid-cols-2 grid w-full gap-6">
      {VARIANTS.map((variant) => (
        <AreaChart.Root
          key={variant}
          data={data}
          config={config}
          xKey="month"
          xScale="point"
          style={{ "--chart-plot-height": "6rem", "--chart-area-opacity": 0.25 }}
          aria-label={`Visitors by month, ${variant} fill`}>
          <AreaChart.Area dataKey="desktop" variant={variant} />
          <AreaChart.Line dataKey="desktop" />
          <AreaChart.XAxis />
        </AreaChart.Root>
      ))}
    </div>
  );
}
