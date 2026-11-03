"use client";

import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig, XFormat } from "@elmeragroup/fuse/chart";

const KWH = [
  18.2, 17.6, 19.4, 21.8, 20.3, 16.9, 15.8, 19.1, 22.4, 23.7, 21.2, 18.8, 17.4, 16.2, 20.6, 24.3, 25.1, 23.9,
  21.4, 19.7, 18.3, 22.8, 26.4, 27.2, 25.6, 22.1, 20.4, 23.5, 27.9, 28.6,
];

/** Thirty days from 20 September 2026, each at midnight in Oslo, which is UTC+2. */
const days = KWH.map((kwh, index) => ({ day: new Date(Date.UTC(2026, 8, 20 + index, -2)), kwh }));

const config = {
  kwh: { label: "Usage", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
} as const satisfies ChartConfig;

/** The axis's format, which the pill prints too, so it reads as the tick it covers. */
const DAY_AND_MONTH = { day: "numeric", month: "short" } as const satisfies XFormat;

export function LineChartDatePill() {
  return (
    <LineChart.Root
      data={days}
      config={config}
      xKey="day"
      interval="day"
      timeZone="Europe/Oslo"
      aria-label="Daily usage, 20 September to 19 October">
      <LineChart.Grid />
      <LineChart.YAxis />
      <LineChart.XAxis format={DAY_AND_MONTH} />
      <LineChart.Line dataKey="kwh" />
      <LineChart.Crosshair>
        <LineChart.SlotLabel />
      </LineChart.Crosshair>
      <LineChart.ActiveDot dataKey="kwh" />
      <LineChart.Tooltip />
      <LineChart.Table />
    </LineChart.Root>
  );
}
