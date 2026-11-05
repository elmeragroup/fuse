"use client";

import { RadarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

import {
  HOURLY_AUTUMN_KWH,
  HOURLY_AUTUMN_START,
} from "../../chart/demos/data/no1-household-hourly-2025-09-2025-10";

const HOUR = 3_600_000;

const hourOf = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "Europe/Oslo",
});
const monthOf = new Intl.DateTimeFormat("en-GB", { month: "numeric", timeZone: "Europe/Oslo" });

/** The mean of each clock hour in Oslo over September and over October. */
function hourMeans() {
  const start = Date.parse(HOURLY_AUTUMN_START);
  const sums = { september: new Array<number>(24).fill(0), october: new Array<number>(24).fill(0) };
  const counts = { september: new Array<number>(24).fill(0), october: new Array<number>(24).fill(0) };
  HOURLY_AUTUMN_KWH.forEach((kwh, index) => {
    const time = new Date(start + index * HOUR);
    const hour = Number(hourOf.format(time));
    const month = monthOf.format(time) === "9" ? "september" : "october";
    sums[month][hour] = (sums[month][hour] ?? 0) + kwh;
    counts[month][hour] = (counts[month][hour] ?? 0) + 1;
  });
  const mean = (month: "september" | "october") =>
    sums[month].map((sum, hour) => Math.round((sum / (counts[month][hour] ?? 1)) * 1000) / 1000);
  return { september: mean("september"), october: mean("october") };
}

const { september, october } = hourMeans();
const hours = october.map((kwh, hour) => ({
  hour: String(hour).padStart(2, "0"),
  october: kwh,
  september: september[hour] ?? 0,
}));

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 2 } as const;

const config = {
  october: { label: "October", color: "chart-1", format: energy },
  september: { label: "September", color: "chart-2", format: energy },
} as const satisfies ChartConfig;

export function RadarChartHours() {
  return (
    <RadarChart.Root
      data={hours}
      config={config}
      nameKey="hour"
      aria-label="A household's mean hour in NO1, autumn 2025">
      <RadarChart.Grid variant="circle" />
      <RadarChart.AngleAxis />
      <RadarChart.Area dataKey="october" />
      <RadarChart.Line dataKey="october" />
      <RadarChart.Line dataKey="september" variant="quiet" />
      <RadarChart.ActiveDot dataKey="october" />
      <RadarChart.Legend />
      <RadarChart.Tooltip />
      <RadarChart.Table />
    </RadarChart.Root>
  );
}
