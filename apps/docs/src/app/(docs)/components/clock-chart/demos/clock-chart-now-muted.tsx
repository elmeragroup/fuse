"use client";

import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// NO1 consumption per hour on 16 October 2026, in MWh, from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
const HOUSEHOLDS = [
  1509, 1391, 1323, 1285, 1277, 1312, 1454, 1636, 1635, 1605, 1575, 1547, 1547, 1567, 1607, 1693, 1827, 1910,
  1998, 2025, 1991, 1948, 1918, 1835,
];

// 16 October 2026 starts at 22:00 UTC on the 15th, since Oslo is on summer time.
const hours = HOUSEHOLDS.map((households, hour) => ({
  start: new Date(Date.UTC(2026, 9, 15, 22 + hour)),
  households,
}));

const energy = { preset: "energy", unit: "MWh", maximumFractionDigits: 0 } as const;

const config = {
  households: { label: "Households", color: "chart-1", format: energy },
} as const satisfies ChartConfig;

// 14:30 in Oslo.
const now = new Date(Date.UTC(2026, 9, 16, 12, 30));

export function ClockChartNowMuted() {
  return (
    <ClockChart.Root
      data={hours}
      config={config}
      xKey="start"
      cycle="day"
      interval="hour"
      timeZone="Europe/Oslo"
      now={now}
      aria-label="NO1 household consumption per hour, 16 October 2026">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.RadiusAxis />
      <ClockChart.Column dataKey="households" />
      <ClockChart.Now label="Now" tone="muted" />
      <ClockChart.Tooltip />
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
