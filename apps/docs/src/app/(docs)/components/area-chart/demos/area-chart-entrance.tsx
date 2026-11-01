"use client";

import { useState } from "react";

import { AreaChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig, ChartIntro } from "@elmeragroup/fuse/chart";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

const ORIGINS: readonly ChartIntro[] = ["left", "right", "center", "edges", "none"];

const KWH = [11.2, 12.8, 10.9, 13.4, 12.6, 12.1, 11.6, 13.9, 12.7, 10.8, 11.9, 13.1, 12.4, 11.7];

/** Fourteen days from 1 October 2026, each starting at midnight in Oslo. */
const days = KWH.map((kwh, index) => ({ day: new Date(Date.UTC(2026, 8, 30 + index, 22)), kwh }));

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 1 },
  },
} as const satisfies ChartConfig;

/** The entrance runs once per Root, so the picker remounts the chart for each origin. */
export function AreaChartEntrance() {
  const [origin, setOrigin] = useState<ChartIntro>("left");
  return (
    <div className="flex w-full flex-col gap-4">
      <ToggleGroup.Root
        aria-label="Entrance origin"
        value={[origin]}
        onValueChange={(value: string[]) => {
          const next = ORIGINS.find((candidate) => candidate === value[0]);
          if (next !== undefined) setOrigin(next);
        }}>
        {ORIGINS.map((candidate) => (
          <ToggleGroup.Item key={candidate} value={candidate}>
            {candidate}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <AreaChart.Root
        key={origin}
        data={days}
        config={config}
        xKey="day"
        xScale="point"
        interval="day"
        timeZone="Europe/Oslo"
        data-intro={origin}
        aria-label="Daily consumption, first half of October">
        <AreaChart.Grid />
        <AreaChart.YAxis />
        <AreaChart.XAxis />
        <AreaChart.Area dataKey="kwh" />
        <AreaChart.Line dataKey="kwh" />
        <AreaChart.Dots dataKey="kwh" />
        <AreaChart.Tooltip />
      </AreaChart.Root>
    </div>
  );
}
