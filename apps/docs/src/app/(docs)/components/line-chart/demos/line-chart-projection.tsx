"use client";

import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** Oslo midnight of a day in October 2025, in summer time up to 26 October. */
function oslo(date: number): Date {
  return new Date(Date.UTC(2025, 9, date, date <= 26 ? -2 : -1));
}

// One household's consumption on 1 to 16 October 2025, with day 5 missing. From day 12 the month-end forecast takes over as a projection.
const KWH = [11.2, 12.8, 10.9, 13.4, null, 12.1, 11.6, 13.9, 12.7, 10.8, 11.9, 13.1, 12.4, 11.7, 12.9, 13.6];

const days = KWH.map((kwh, index) => ({ day: oslo(index + 1), kwh }));

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    projectedFrom: oslo(12),
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 1 },
  },
} as const satisfies ChartConfig;

export function LineChartProjection() {
  return (
    <LineChart.Root
      data={days}
      config={config}
      xKey="day"
      xScale="point"
      interval="day"
      timeZone="Europe/Oslo"
      aria-label="Consumption per day, 1 to 16 October 2025">
      <LineChart.Grid />
      <LineChart.YAxis />
      <LineChart.XAxis />
      <LineChart.Line dataKey="kwh" />
      <LineChart.Tooltip />
      <LineChart.Table />
    </LineChart.Root>
  );
}
