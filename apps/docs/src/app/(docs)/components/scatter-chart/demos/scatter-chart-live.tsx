"use client";

import { useEffect, useState } from "react";

import { ScatterChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Invented values, made by a fixed generator. A heat pump's power in kW against the outdoor
// temperature in °C, one reading every few seconds as an evening gets colder.
function reading(index: number) {
  const tempC = Math.round((6 - index * 0.35 + Math.sin(index * 1.7) * 1.2) * 10) / 10;
  const kw = Math.round((2.1 - 0.16 * tempC + Math.cos(index * 2.3) * 0.25) * 100) / 100;
  return { tempC, kw, series: "pump" };
}

const FIRST = 12;
const LAST = 60;

const config = {
  pump: {
    label: "Heat pump",
    color: "chart-2",
    format: { preset: "power", unit: "kW", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

export function ScatterChartLive() {
  const [count, setCount] = useState(FIRST);
  // It starts paused, so the page's first render and every reader's first look are the same.
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running || count >= LAST) return undefined;
    const timer = setTimeout(() => {
      setCount((value) => value + 1);
    }, 900);
    return () => {
      clearTimeout(timer);
    };
  }, [running, count]);
  const data = Array.from({ length: count }, (_, index) => reading(index));
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex gap-2">
        <button type="button" disabled={count >= LAST} onClick={() => setRunning(!running)}>
          {running && count < LAST ? "Pause" : "Stream readings"}
        </button>
        <button
          type="button"
          disabled={count === FIRST}
          onClick={() => {
            setCount(FIRST);
            setRunning(false);
          }}>
          Start over
        </button>
      </div>
      <ScatterChart.Root
        data={data}
        config={config}
        xKey="tempC"
        yKey="kw"
        seriesKey="series"
        xFormat={{ style: "unit", unit: "celsius", maximumFractionDigits: 1 }}
        xLabel="Outdoor temperature"
        yLabel="Power"
        aria-label="Heat pump power against outdoor temperature, live">
        <ScatterChart.Grid />
        <ScatterChart.XAxis format={{ maximumFractionDigits: 0 }} />
        <ScatterChart.YAxis />
        <ScatterChart.Points dataKey="pump" />
        <ScatterChart.ActiveDot />
        <ScatterChart.Tooltip />
      </ScatterChart.Root>
    </div>
  );
}
