"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// A day of quarter-hour solar production, in kW, from 10:00 in Oslo on 7 June 2026, which is UTC+2.
const KW = [
  2.1, 2.4, 2.2, 2.8, 3.1, 2.9, 3.4, 3.6, 3.2, 3.8, 4.1, 3.9, 3.5, 3.7, 4.2, 4.4, 4.0, 3.6, 3.9, 4.3,
];
const FIRST = Date.UTC(2026, 5, 7, 8);
const QUARTER = 15 * 60 * 1000;

/** A window of eight quarters starting at a reading. */
function windowAt(start: number) {
  return Array.from({ length: 8 }, (_, index) => ({
    at: new Date(FIRST + (start + index) * QUARTER),
    kw: KW[(start + index) % KW.length] ?? 0,
  }));
}

const config = {
  kw: {
    label: "Production",
    color: "chart-1",
    format: { preset: "power", unit: "kW", maximumFractionDigits: 1 },
  },
} as const satisfies ChartConfig;

/**
 * Each press appends the next reading and drops the first, so the line slides one quarter left.
 * Its dots and the latest marker move with the line, and a reader who prefers reduced motion sees the
 * new line at once.
 */
export function LineChartUpdate() {
  const [start, setStart] = useState(0);
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <Button variant="outline" onClick={() => setStart((value) => value + 1)}>
        Next reading
      </Button>
      <LineChart.Root
        data={windowAt(start)}
        config={config}
        xKey="at"
        xScale="point"
        interval="quarter-hour"
        timeZone="Europe/Oslo"
        aria-label="Solar production, last two hours">
        <LineChart.Grid />
        <LineChart.YAxis />
        <LineChart.XAxis />
        <LineChart.Line dataKey="kw" />
        <LineChart.Dots dataKey="kw" />
        <LineChart.Marker dataKey="kw" at="last">
          <LineChart.ValueLabel />
        </LineChart.Marker>
        <LineChart.Crosshair />
        <LineChart.Tooltip />
      </LineChart.Root>
    </div>
  );
}
