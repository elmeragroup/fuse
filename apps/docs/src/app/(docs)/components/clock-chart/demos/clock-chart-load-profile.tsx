"use client";

import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

import {
  HOURLY_AUTUMN_KWH,
  HOURLY_AUTUMN_START,
} from "../../chart/demos/data/no1-household-hourly-2025-09-2025-10";

const HOUR = 3_600_000;

/** Wednesday 15 October 2025 in Oslo, and the household's day until 17:20. */
const today = Date.parse("2025-10-14T22:00:00Z");
const now = Date.parse("2025-10-15T15:20:00Z");
const first = (today - Date.parse(HOURLY_AUTUMN_START)) / HOUR;

const hours = HOURLY_AUTUMN_KWH.slice(first, first + 24).flatMap((kwh, hour) =>
  today + hour * HOUR <= now ? [{ start: today + hour * HOUR, kwh }] : []
);

const config = {
  kwh: {
    label: "Today",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

export function ClockChartLoadProfile() {
  return (
    <ClockChart.Root
      data={hours}
      config={config}
      xKey="start"
      cycle="day"
      timeZone="Europe/Oslo"
      interval="hour"
      now={now}
      data-fade="past"
      aria-label="A household's consumption today, hour by hour">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.Column dataKey="kwh" emphasis="now" />
      <ClockChart.Now label="Now" />
      <ClockChart.Center />
      <ClockChart.Tooltip />
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
