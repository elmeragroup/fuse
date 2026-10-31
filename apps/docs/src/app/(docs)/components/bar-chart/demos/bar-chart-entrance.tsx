"use client";

import { useState } from "react";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig, ChartIntro } from "@elmeragroup/fuse/chart";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

const ORIGINS: readonly ChartIntro[] = ["left", "right", "center", "edges", "none"];

const months = [
  { month: "Jan", kwh: 1820 },
  { month: "Feb", kwh: 1640 },
  { month: "Mar", kwh: 1390 },
  { month: "Apr", kwh: 980 },
  { month: "May", kwh: 720 },
  { month: "Jun", kwh: 540 },
];

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

/** The entrance runs once per Root, so the picker remounts the chart for each origin. */
export function BarChartEntrance() {
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
      <BarChart.Root
        key={origin}
        data={months}
        config={config}
        xKey="month"
        data-intro={origin}
        aria-label="Consumption per month">
        <BarChart.Grid />
        <BarChart.YAxis />
        <BarChart.XAxis />
        <BarChart.Bar dataKey="kwh" />
        <BarChart.Tooltip />
        <BarChart.Table />
      </BarChart.Root>
    </div>
  );
}
