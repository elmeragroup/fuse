"use client";

import { GaugeChart } from "@elmeragroup/fuse/chart";

// This hour's consumption so far against the grid tariff's 5 kWh capacity step.
const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

export function GaugeChartClosedRing() {
  return (
    <GaugeChart.Root
      value={3.9}
      max={5}
      valueFormat={energy}
      startAngle={0}
      endAngle={360}
      aria-label="This hour's consumption against the 5 kWh capacity step">
      <GaugeChart.ProgressRing />
      <GaugeChart.Center>
        <GaugeChart.CenterValue />
        <GaugeChart.CenterLabel>This hour</GaugeChart.CenterLabel>
      </GaugeChart.Center>
    </GaugeChart.Root>
  );
}
