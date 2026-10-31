"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The rows and labels below come from the evilcharts examples `ex-default-variant-bar-chart`,
// `ex-hatched-variant-bar-chart`, `ex-duotone-variant-bar-chart`,
// `ex-duotone-reverse-variant-bar-chart`, `ex-gradient-variant-bar-chart` and
// `ex-stripped-variant-bar-chart`, commit ecbd6a5, which share them.
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

const VARIANTS = ["default", "hatched", "duotone", "duotone-reverse", "gradient", "striped"] as const;

/** The pair of series, both drawn in one look. */
function configIn(variant: (typeof VARIANTS)[number]) {
  return {
    desktop: { label: "Desktop", color: "chart-1", variant },
    mobile: { label: "Mobile", color: "chart-2", variant },
  } as const satisfies ChartConfig;
}

/** Each look a series' config gives its bars, on a grouped pair of series. */
export function BarChartVariants() {
  return (
    <div className="sm:grid-cols-2 grid w-full gap-6">
      {VARIANTS.map((variant) => (
        <BarChart.Root
          key={variant}
          data={data}
          config={configIn(variant)}
          xKey="month"
          style={{ "--chart-plot-height": "8rem" }}
          aria-label={`Visitors by month, ${variant} bars`}>
          <BarChart.Grid variant="dashed" />
          <BarChart.XAxis />
          <BarChart.BarGroup series={["desktop", "mobile"]}>
            <BarChart.Bar dataKey="desktop" />
            <BarChart.Bar dataKey="mobile" />
          </BarChart.BarGroup>
          <BarChart.Legend />
          <BarChart.Tooltip />
        </BarChart.Root>
      ))}
    </div>
  );
}
