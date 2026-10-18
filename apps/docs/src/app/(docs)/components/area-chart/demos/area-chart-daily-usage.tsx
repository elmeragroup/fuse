"use client";

import { AreaChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const GRID = [14.2, 13.8, 15.1, 16.4, 12.9, 11.7, 13.3, 14.8, 15.6, 17.2, 16.1, 13.4, 12.2, 14.0];
const SOLAR = [3.1, 4.2, 2.6, 1.8, 4.9, 5.3, 3.7, 2.9, 2.2, 1.4, 1.9, 3.8, 4.4, 3.2];

/** Fourteen days from 1 October 2026, each starting at midnight in Oslo. */
const days = GRID.map((grid, index) => ({
  day: new Date(Date.UTC(2026, 8, 30 + index, 22)),
  grid,
  solar: SOLAR[index] ?? null,
}));

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

const config = {
  grid: { label: "From the grid", color: "chart-1", format: energy },
  solar: { label: "Solar", color: "chart-2", format: energy },
} as const satisfies ChartConfig;

export function AreaChartDailyUsage() {
  return (
    <AreaChart.Root
      data={days}
      config={config}
      xKey="day"
      xScale="point"
      interval="day"
      timeZone="Europe/Oslo"
      aria-label="Daily usage, first half of October">
      <AreaChart.LegendToggleGroup />
      <AreaChart.Grid />
      <AreaChart.YAxis />
      <AreaChart.XAxis />
      <AreaChart.Area dataKey="grid" variant="gradient" />
      <AreaChart.Line dataKey="grid" curve="monotone" />
      <AreaChart.Line dataKey="solar" variant="dashed" />
      <AreaChart.Crosshair />
      <AreaChart.ActiveDot dataKey="grid" />
      <AreaChart.Tooltip />
      <AreaChart.Empty />
      <AreaChart.Brush>
        <AreaChart.BrushPreview>
          <AreaChart.Area dataKey="grid" />
        </AreaChart.BrushPreview>
      </AreaChart.Brush>
      <AreaChart.Table />
    </AreaChart.Root>
  );
}
