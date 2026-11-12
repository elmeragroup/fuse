"use client";

import { GaugeChart } from "@elmeragroup/fuse/chart";

// A home battery's state of charge, on a solid track with the charge ring round it.
const percent = { style: "percent", maximumFractionDigits: 0 } as const;

export function GaugeChartBattery() {
  return (
    <GaugeChart.Root
      value={0.72}
      max={1}
      valueFormat={percent}
      startAngle={-120}
      endAngle={120}
      aria-label="Home battery state of charge">
      <GaugeChart.ProgressRing color="chart-sentiment-positive" />
      <GaugeChart.Track variant="solid" />
      <GaugeChart.Glow color="chart-sentiment-positive" />
      <GaugeChart.Fill color="chart-sentiment-positive" />
      <GaugeChart.Center>
        <GaugeChart.CenterValue />
        <GaugeChart.CenterLabel>Charged</GaugeChart.CenterLabel>
      </GaugeChart.Center>
    </GaugeChart.Root>
  );
}
