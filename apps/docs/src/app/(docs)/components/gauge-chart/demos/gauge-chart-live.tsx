"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { GaugeChart } from "@elmeragroup/fuse/chart";

// One meter's power draw, read every ten seconds as the oven, the heat pump and the car charger
// switch on and off, against an 11 kW main fuse.
const readings = [2.4, 6.8, 9.7, 4.1, 10.6, 1.2] as const;

const power = { preset: "power", unit: "kW", maximumFractionDigits: 1 } as const;

export function GaugeChartLive() {
  const [index, setIndex] = useState(0);
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <GaugeChart.Root value={readings[index] ?? 0} max={11} valueFormat={power} aria-label="Power draw now">
        <GaugeChart.Zone from={9} to={11} color="chart-sentiment-negative" />
        <GaugeChart.Track />
        <GaugeChart.Glow />
        <GaugeChart.Fill />
        <GaugeChart.Ruler />
        <GaugeChart.Needle />
        <GaugeChart.Center>
          <GaugeChart.CenterValue />
          <GaugeChart.CenterLabel>Power now</GaugeChart.CenterLabel>
        </GaugeChart.Center>
      </GaugeChart.Root>
      <Button
        variant="outline"
        onClick={() => {
          setIndex((current) => (current + 1) % readings.length);
        }}>
        Next reading
      </Button>
    </div>
  );
}
