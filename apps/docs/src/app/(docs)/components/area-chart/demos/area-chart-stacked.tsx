"use client";

import { useState } from "react";

import { AreaChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

// The rows and labels below come from the evilcharts example `ex-stacked-type-area-chart`, commit ecbd6a5.
// Copyright (c) 2026 Gurbinder. Released under the MIT License, whose full text is in
// apps/docs/src/app/(docs)/components/chart/demos/LICENSE-evilcharts.
const data = [
  { month: "Jan", desktop: 342, mobile: 245 },
  { month: "Feb", desktop: 876, mobile: 654 },
  { month: "Mar", desktop: 512, mobile: 387 },
  { month: "Apr", desktop: 629, mobile: 521 },
  { month: "May", desktop: 458, mobile: 412 },
  { month: "Jun", desktop: 781, mobile: 598 },
  { month: "Jul", desktop: 394, mobile: 312 },
  { month: "Aug", desktop: 925, mobile: 743 },
  { month: "Sep", desktop: 647, mobile: 489 },
  { month: "Oct", desktop: 532, mobile: 476 },
  { month: "Nov", desktop: 803, mobile: 687 },
  { month: "Dec", desktop: 271, mobile: 198 },
];

const config = {
  desktop: { label: "Desktop", color: "chart-1", stack: "visits" },
  mobile: { label: "Mobile", color: "chart-2", stack: "visits" },
} as const satisfies ChartConfig;

const OFFSETS = ["diverging", "expand"] as const;

/** The two series stack, and "expand" draws each month's shares of its total. */
export function AreaChartStacked() {
  const [offset, setOffset] = useState<(typeof OFFSETS)[number]>("diverging");
  return (
    <div className="flex w-full flex-col gap-4">
      <ToggleGroup.Root
        aria-label="Stack offset"
        value={[offset]}
        onValueChange={(value: string[]) => {
          const next = OFFSETS.find((candidate) => candidate === value[0]);
          if (next !== undefined) setOffset(next);
        }}>
        {OFFSETS.map((candidate) => (
          <ToggleGroup.Item key={candidate} value={candidate}>
            {candidate}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <AreaChart.Root
        data={data}
        config={config}
        xKey="month"
        xScale="point"
        stackOffset={offset}
        aria-label="Visitors by month and device">
        <AreaChart.Grid />
        <AreaChart.YAxis />
        <AreaChart.XAxis />
        <AreaChart.Area dataKey="desktop" variant="solid" />
        <AreaChart.Area dataKey="mobile" variant="solid" />
        <AreaChart.Line dataKey="desktop" />
        <AreaChart.Line dataKey="mobile" />
        <AreaChart.Crosshair />
        <AreaChart.Tooltip />
        <AreaChart.Legend />
        <AreaChart.Table />
      </AreaChart.Root>
    </div>
  );
}
