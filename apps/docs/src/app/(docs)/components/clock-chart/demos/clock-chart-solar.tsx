"use client";

import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One household's solar production per quarter-hour on 29 March 2026, the 23-hour spring-forward day,
// derived from the Elhub datasets PRODUCTION_PER_GROUP_MBA_15MIN and CONSUMPTION_PER_GROUP_MBA_HOUR at
// https://api.elhub.no, price area NO1, scaled so the day's highest quarter is a 5 kW peak.
// Elhub licenses its datasets under CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const PROSUMER_SOLAR_2026_03_29 = [
  { startTime: "2026-03-29T00:00:00+01:00", solarKwh: 0.0025 },
  { startTime: "2026-03-29T00:15:00+01:00", solarKwh: 0.0026 },
  { startTime: "2026-03-29T00:30:00+01:00", solarKwh: 0.0032 },
  { startTime: "2026-03-29T00:45:00+01:00", solarKwh: 0.0039 },
  { startTime: "2026-03-29T01:00:00+01:00", solarKwh: 0.006 },
  { startTime: "2026-03-29T01:15:00+01:00", solarKwh: 0.0064 },
  { startTime: "2026-03-29T01:30:00+01:00", solarKwh: 0.0069 },
  { startTime: "2026-03-29T01:45:00+01:00", solarKwh: 0.0068 },
  { startTime: "2026-03-29T03:00:00+02:00", solarKwh: 0.0053 },
  { startTime: "2026-03-29T03:15:00+02:00", solarKwh: 0.0039 },
  { startTime: "2026-03-29T03:30:00+02:00", solarKwh: 0.0071 },
  { startTime: "2026-03-29T03:45:00+02:00", solarKwh: 0.0086 },
  { startTime: "2026-03-29T04:00:00+02:00", solarKwh: 0.0085 },
  { startTime: "2026-03-29T04:15:00+02:00", solarKwh: 0.0085 },
  { startTime: "2026-03-29T04:30:00+02:00", solarKwh: 0.0087 },
  { startTime: "2026-03-29T04:45:00+02:00", solarKwh: 0.0084 },
  { startTime: "2026-03-29T05:00:00+02:00", solarKwh: 0.0086 },
  { startTime: "2026-03-29T05:15:00+02:00", solarKwh: 0.0091 },
  { startTime: "2026-03-29T05:30:00+02:00", solarKwh: 0.0088 },
  { startTime: "2026-03-29T05:45:00+02:00", solarKwh: 0.0089 },
  { startTime: "2026-03-29T06:00:00+02:00", solarKwh: 0.0084 },
  { startTime: "2026-03-29T06:15:00+02:00", solarKwh: 0.0082 },
  { startTime: "2026-03-29T06:30:00+02:00", solarKwh: 0.008 },
  { startTime: "2026-03-29T06:45:00+02:00", solarKwh: 0.0085 },
  { startTime: "2026-03-29T07:00:00+02:00", solarKwh: 0.0124 },
  { startTime: "2026-03-29T07:15:00+02:00", solarKwh: 0.0124 },
  { startTime: "2026-03-29T07:30:00+02:00", solarKwh: 0.0173 },
  { startTime: "2026-03-29T07:45:00+02:00", solarKwh: 0.0264 },
  { startTime: "2026-03-29T08:00:00+02:00", solarKwh: 0.0956 },
  { startTime: "2026-03-29T08:15:00+02:00", solarKwh: 0.1097 },
  { startTime: "2026-03-29T08:30:00+02:00", solarKwh: 0.1257 },
  { startTime: "2026-03-29T08:45:00+02:00", solarKwh: 0.1488 },
  { startTime: "2026-03-29T09:00:00+02:00", solarKwh: 0.3323 },
  { startTime: "2026-03-29T09:15:00+02:00", solarKwh: 0.3578 },
  { startTime: "2026-03-29T09:30:00+02:00", solarKwh: 0.3844 },
  { startTime: "2026-03-29T09:45:00+02:00", solarKwh: 0.4133 },
  { startTime: "2026-03-29T10:00:00+02:00", solarKwh: 0.6903 },
  { startTime: "2026-03-29T10:15:00+02:00", solarKwh: 0.7201 },
  { startTime: "2026-03-29T10:30:00+02:00", solarKwh: 0.7444 },
  { startTime: "2026-03-29T10:45:00+02:00", solarKwh: 0.7746 },
  { startTime: "2026-03-29T11:00:00+02:00", solarKwh: 1.0426 },
  { startTime: "2026-03-29T11:15:00+02:00", solarKwh: 1.069 },
  { startTime: "2026-03-29T11:30:00+02:00", solarKwh: 1.0904 },
  { startTime: "2026-03-29T11:45:00+02:00", solarKwh: 1.1017 },
  { startTime: "2026-03-29T12:00:00+02:00", solarKwh: 1.2334 },
  { startTime: "2026-03-29T12:15:00+02:00", solarKwh: 1.2424 },
  { startTime: "2026-03-29T12:30:00+02:00", solarKwh: 1.2451 },
  { startTime: "2026-03-29T12:45:00+02:00", solarKwh: 1.25 },
  { startTime: "2026-03-29T13:00:00+02:00", solarKwh: 1.1754 },
  { startTime: "2026-03-29T13:15:00+02:00", solarKwh: 1.1661 },
  { startTime: "2026-03-29T13:30:00+02:00", solarKwh: 1.1509 },
  { startTime: "2026-03-29T13:45:00+02:00", solarKwh: 1.1144 },
  { startTime: "2026-03-29T14:00:00+02:00", solarKwh: 0.9432 },
  { startTime: "2026-03-29T14:15:00+02:00", solarKwh: 0.9489 },
  { startTime: "2026-03-29T14:30:00+02:00", solarKwh: 0.9026 },
  { startTime: "2026-03-29T14:45:00+02:00", solarKwh: 0.8629 },
  { startTime: "2026-03-29T15:00:00+02:00", solarKwh: 0.6007 },
  { startTime: "2026-03-29T15:15:00+02:00", solarKwh: 0.564 },
  { startTime: "2026-03-29T15:30:00+02:00", solarKwh: 0.494 },
  { startTime: "2026-03-29T15:45:00+02:00", solarKwh: 0.4526 },
  { startTime: "2026-03-29T16:00:00+02:00", solarKwh: 0.2146 },
  { startTime: "2026-03-29T16:15:00+02:00", solarKwh: 0.1972 },
  { startTime: "2026-03-29T16:30:00+02:00", solarKwh: 0.1802 },
  { startTime: "2026-03-29T16:45:00+02:00", solarKwh: 0.1584 },
  { startTime: "2026-03-29T17:00:00+02:00", solarKwh: 0.0876 },
  { startTime: "2026-03-29T17:15:00+02:00", solarKwh: 0.0774 },
  { startTime: "2026-03-29T17:30:00+02:00", solarKwh: 0.0744 },
  { startTime: "2026-03-29T17:45:00+02:00", solarKwh: 0.0641 },
  { startTime: "2026-03-29T18:00:00+02:00", solarKwh: 0.0313 },
  { startTime: "2026-03-29T18:15:00+02:00", solarKwh: 0.0252 },
  { startTime: "2026-03-29T18:30:00+02:00", solarKwh: 0.0187 },
  { startTime: "2026-03-29T18:45:00+02:00", solarKwh: 0.0154 },
  { startTime: "2026-03-29T19:00:00+02:00", solarKwh: 0.0064 },
  { startTime: "2026-03-29T19:15:00+02:00", solarKwh: 0.0047 },
  { startTime: "2026-03-29T19:30:00+02:00", solarKwh: 0.004 },
  { startTime: "2026-03-29T19:45:00+02:00", solarKwh: 0.0034 },
  { startTime: "2026-03-29T20:00:00+02:00", solarKwh: 0.0029 },
  { startTime: "2026-03-29T20:15:00+02:00", solarKwh: 0.0029 },
  { startTime: "2026-03-29T20:30:00+02:00", solarKwh: 0.003 },
  { startTime: "2026-03-29T20:45:00+02:00", solarKwh: 0.003 },
  { startTime: "2026-03-29T21:00:00+02:00", solarKwh: 0.0029 },
  { startTime: "2026-03-29T21:15:00+02:00", solarKwh: 0.0028 },
  { startTime: "2026-03-29T21:30:00+02:00", solarKwh: 0.0028 },
  { startTime: "2026-03-29T21:45:00+02:00", solarKwh: 0.0028 },
  { startTime: "2026-03-29T22:00:00+02:00", solarKwh: 0.0027 },
  { startTime: "2026-03-29T22:15:00+02:00", solarKwh: 0.0027 },
  { startTime: "2026-03-29T22:30:00+02:00", solarKwh: 0.0028 },
  { startTime: "2026-03-29T22:45:00+02:00", solarKwh: 0.0027 },
  { startTime: "2026-03-29T23:00:00+02:00", solarKwh: 0.0027 },
  { startTime: "2026-03-29T23:15:00+02:00", solarKwh: 0.0027 },
  { startTime: "2026-03-29T23:30:00+02:00", solarKwh: 0.0027 },
  { startTime: "2026-03-29T23:45:00+02:00", solarKwh: 0.0027 },
];

const quarters = PROSUMER_SOLAR_2026_03_29.map(({ startTime, solarKwh }) => ({
  start: new Date(startTime),
  solar: solarKwh,
}));

const config = {
  solar: {
    label: "Solar",
    color: "chart-3",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 3 },
  },
} as const satisfies ChartConfig;

export function ClockChartSolar() {
  return (
    <ClockChart.Root
      data={quarters}
      config={config}
      xKey="start"
      cycle="day"
      timeZone="Europe/Oslo"
      interval="quarter-hour"
      aria-label="Solar production per quarter-hour, 29 March 2026">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.Area dataKey="solar" />
      <ClockChart.Line dataKey="solar" />
      <ClockChart.Tooltip />
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
