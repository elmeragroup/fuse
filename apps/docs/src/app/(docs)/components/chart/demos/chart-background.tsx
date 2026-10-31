"use client";

import { useState } from "react";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartBackgroundPattern, ChartConfig } from "@elmeragroup/fuse/chart";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

const PATTERNS: readonly ChartBackgroundPattern[] = [
  "dots",
  "grid",
  "cross-hatch",
  "diagonal-lines",
  "plus",
  "falling-triangles",
  "4-pointed-star",
  "tiny-checkers",
  "overlapping-circles",
  "wiggle-lines",
  "bubbles",
];

/** Twelve hours from midnight in Oslo on 17 October 2026, which is UTC+2. */
const hours = [0.42, 0.38, 0.35, 0.34, 0.36, 0.51, 0.88, 1.24, 1.02, 0.74, 0.66, 0.61].map((kwh, index) => ({
  start: new Date(Date.UTC(2026, 9, 16, 22 + index)),
  kwh,
}));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
    variant: "gradient",
  },
} as const satisfies ChartConfig;

export function ChartBackgroundPatterns() {
  const [pattern, setPattern] = useState<ChartBackgroundPattern>("dots");
  return (
    <div className="flex w-full flex-col gap-4">
      <ToggleGroup.Root
        aria-label="Pattern"
        value={[pattern]}
        onValueChange={(value: string[]) => {
          const next = PATTERNS.find((candidate) => candidate === value[0]);
          if (next !== undefined) setPattern(next);
        }}
        className="flex-wrap">
        {PATTERNS.map((candidate) => (
          <ToggleGroup.Item key={candidate} value={candidate}>
            {candidate}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <Chart.Root
        data={hours}
        config={config}
        xKey="start"
        interval="hour"
        timeZone="Europe/Oslo"
        aria-label="Usage per hour, 17 October">
        <Chart.Background variant={pattern} />
        <Chart.YAxis />
        <Chart.XAxis />
        <Chart.Bar dataKey="kwh" />
        <Chart.Tooltip />
        <Chart.Table />
      </Chart.Root>
    </div>
  );
}
