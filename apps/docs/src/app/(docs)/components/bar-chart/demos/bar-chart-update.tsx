"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** Oslo midnight of a day in October or November 2025, in summer time up to 26 October. */
function oslo(month: 10 | 11, date: number): Date {
  return new Date(Date.UTC(2025, month - 1, date, month === 10 && date <= 26 ? -2 : -1));
}

/** Three loads: 1 to 10 October, a reload of 2 to 11 October, and 1 to 9 November. */
const LOADS = [
  {
    name: "1 to 10 October",
    rows: [
      [1, 4, 2],
      [2, 6, 3],
      [3, 5, 2],
      [4, 7, 4],
      [5, 3, 2],
      [6, 6, 3],
      [7, 8, 3],
      [8, 5, 2],
      [9, 4, 3],
      [10, 6, 2],
    ],
    month: 10,
  },
  {
    name: "2 to 11 October",
    rows: [
      [2, 6, 3],
      [3, 5, 2],
      [4, 5, 3],
      [5, 3, 2],
      [6, 6, 3],
      [7, 7, 4],
      [8, 5, 2],
      [9, 4, 3],
      [10, 6, 2],
      [11, 5, 2],
    ],
    month: 10,
  },
  {
    name: "1 to 9 November",
    rows: [
      [1, 8, 4],
      [2, 10, 5],
      [3, 9, 3],
      [4, 12, 6],
      [5, 7, 4],
      [6, 9, 5],
      [7, 11, 5],
      [8, 10, 4],
      [9, 8, 3],
    ],
    month: 11,
  },
] as const;

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const config = {
  base: { label: "Base load", color: "chart-1", stack: "day", format: energy },
  peak: { label: "Peak load", color: "chart-2", stack: "day", format: energy },
} as const satisfies ChartConfig;

/** A data update moves each bar that stays, fades in the bar it adds and drops the bar that leaves. */
export function BarChartUpdate() {
  const [load, setLoad] = useState(0);
  const current = LOADS[load] ?? LOADS[0];
  const days = current.rows.map(([date, base, peak]) => ({ day: oslo(current.month, date), base, peak }));
  return (
    <div className="flex w-full flex-col gap-4">
      <Button
        variant="outline"
        className="self-start"
        onClick={() => {
          setLoad((load + 1) % LOADS.length);
        }}>
        Load {LOADS[(load + 1) % LOADS.length]?.name}
      </Button>
      <BarChart.Root
        data={days}
        config={config}
        xKey="day"
        interval="day"
        timeZone="Europe/Oslo"
        aria-label={`Daily load, ${current.name}`}>
        <BarChart.Grid />
        <BarChart.YAxis />
        <BarChart.XAxis />
        <BarChart.ReferenceLine y={6} label="Contracted {value}" variant="dashed" />
        <BarChart.Bar dataKey="base" />
        <BarChart.Bar dataKey="peak" />
        <BarChart.Tooltip />
        <BarChart.Legend />
        <BarChart.Table />
      </BarChart.Root>
    </div>
  );
}
