"use client";

import { GaugeChart } from "@elmeragroup/fuse/chart";

// An hour whose consumption has passed the grid tariff's 5 kWh capacity step.
const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

export function GaugeChartOverMax() {
  return (
    <GaugeChart.Root
      value={5.6}
      max={5}
      valueFormat={energy}
      aria-label="This hour's consumption against the 5 kWh capacity step">
      <GaugeChart.Track />
      <GaugeChart.Fill />
      <GaugeChart.Center>
        <GaugeChart.CenterValue />
        <GaugeChart.CenterLabel>This hour</GaugeChart.CenterLabel>
      </GaugeChart.Center>
    </GaugeChart.Root>
  );
}
