"use client";

import { GaugeChart } from "@elmeragroup/fuse/chart";

// An electric car's charging session: energy delivered so far against the 40 kWh it asked for.
const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

export function GaugeChartCharging() {
  return (
    <GaugeChart.Root
      value={27.6}
      max={40}
      valueFormat={energy}
      startAngle={0}
      endAngle={360}
      aria-label="Energy delivered in this charging session">
      <GaugeChart.ProgressRing />
      <GaugeChart.Center>
        <GaugeChart.CenterValue />
        <GaugeChart.CenterLabel>of 40 kWh</GaugeChart.CenterLabel>
      </GaugeChart.Center>
    </GaugeChart.Root>
  );
}
