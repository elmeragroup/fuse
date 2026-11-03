"use client";

import { useState } from "react";

import { AreaChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

// One household's consumption per month, split into the grid tariff's day and night rate periods.
const data = [
  { month: "Jan", day: 1531, night: 881 },
  { month: "Feb", day: 1384, night: 784 },
  { month: "Mar", day: 1220, night: 673 },
  { month: "Apr", day: 948, night: 499 },
  { month: "May", day: 712, night: 350 },
  { month: "Jun", day: 547, night: 259 },
  { month: "Jul", day: 499, night: 232 },
  { month: "Aug", day: 535, night: 253 },
  { month: "Sep", day: 676, night: 328 },
  { month: "Oct", day: 961, night: 497 },
  { month: "Nov", day: 1229, night: 688 },
  { month: "Dec", day: 1458, night: 838 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const config = {
  day: { label: "Day", color: "chart-1", stack: "consumption", format: energy },
  night: { label: "Night", color: "chart-2", stack: "consumption", format: energy },
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
        aria-label="Day and night consumption per month">
        <AreaChart.Grid />
        <AreaChart.YAxis />
        <AreaChart.XAxis />
        <AreaChart.Area dataKey="day" variant="solid" />
        <AreaChart.Area dataKey="night" variant="solid" />
        <AreaChart.Line dataKey="day" />
        <AreaChart.Line dataKey="night" />
        <AreaChart.Crosshair />
        <AreaChart.Tooltip />
        <AreaChart.Legend />
        <AreaChart.Table />
      </AreaChart.Root>
    </div>
  );
}
