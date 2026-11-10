"use client";

import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// A new meter with no readings yet today.
const hours: { start: Date; kwh: number }[] = [];

const config = {
  kwh: { label: "Today", color: "chart-1" },
} as const satisfies ChartConfig;

export function ClockChartEmpty() {
  return (
    <ClockChart.Root
      data={hours}
      config={config}
      xKey="start"
      cycle="day"
      timeZone="Europe/Oslo"
      interval="hour"
      aria-label="Today's consumption">
      <ClockChart.Column dataKey="kwh" />
      <ClockChart.Empty />
    </ClockChart.Root>
  );
}
