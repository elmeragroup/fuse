"use client";

import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

import {
  HOURLY_AUTUMN_KWH,
  HOURLY_AUTUMN_START,
} from "../../chart/demos/data/no1-household-hourly-2025-09-2025-10";

const HOUR = 3_600_000;
const WEEK = 168;

/** Wednesday 15 October 2025 in Oslo, until 17:20, beside the same day a week before. */
const today = Date.parse("2025-10-14T22:00:00Z");
const now = Date.parse("2025-10-15T15:20:00Z");
const first = (today - Date.parse(HOURLY_AUTUMN_START)) / HOUR;

// The recipe: last week's reading rides in a second column of today's rows, so both share the dial.
const hours = Array.from({ length: 24 }, (_, hour) => {
  const start = today + hour * HOUR;
  const lastWeek = HOURLY_AUTUMN_KWH[first + hour - WEEK] ?? 0;
  const kwh = HOURLY_AUTUMN_KWH[first + hour];
  return start <= now && kwh !== undefined ? { start, kwh, lastWeek } : { start, lastWeek };
});

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 2 } as const;

const config = {
  kwh: { label: "Today", color: "chart-1", format: energy },
  lastWeek: { label: "Same day last week", color: "chart-2", format: energy },
} as const satisfies ChartConfig;

export function ClockChartLastWeek() {
  return (
    <ClockChart.Root
      data={hours}
      config={config}
      xKey="start"
      cycle="day"
      timeZone="Europe/Oslo"
      interval="hour"
      now={now}
      aria-label="Today's consumption against the same day last week">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.Line dataKey="lastWeek" variant="dashed" />
      <ClockChart.Area dataKey="kwh" />
      <ClockChart.Line dataKey="kwh" />
      <ClockChart.ActiveDot dataKey="kwh" />
      <ClockChart.Now />
      <ClockChart.Legend />
      <ClockChart.Tooltip />
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
