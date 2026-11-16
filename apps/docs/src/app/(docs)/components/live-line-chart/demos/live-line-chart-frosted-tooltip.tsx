"use client";

import { useEffect, useState } from "react";

import { LiveLineChart } from "@elmeragroup/fuse/chart";
import type { LiveLineChartPoint } from "@elmeragroup/fuse/chart";

/** Reading `index` of a house's power draw in kW: a fixed wave around 2.4 kW. */
function powerAt(index: number): number {
  return Math.round((2.4 + 0.6 * Math.sin(index / 6) + 0.25 * Math.sin(index / 1.7)) * 100) / 100;
}

/** A minute of readings a second apart, ending now, then one more each second. */
function useMeterFeed(): LiveLineChartPoint[] {
  const [readings, setReadings] = useState<LiveLineChartPoint[]>([]);
  useEffect(() => {
    const start = Date.now();
    let index = 60;
    const history = Array.from({ length: 60 }, (_, at) => ({
      time: start - (60 - at) * 1000,
      value: powerAt(at),
    }));
    const first = setTimeout(() => setReadings(history), 0);
    const timer = setInterval(() => {
      const reading = { time: Date.now(), value: powerAt(index) };
      index += 1;
      // Keep twice the 30 s window.
      setReadings((previous) => [...previous.slice(-119), reading]);
    }, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return readings;
}

export function LiveLineChartFrostedTooltip() {
  const readings = useMeterFeed();
  return (
    <LiveLineChart.Root
      data={readings}
      label="Power"
      valueFormat={{ preset: "power", unit: "kW", minimumFractionDigits: 2, maximumFractionDigits: 2 }}
      timeZone="Europe/Oslo"
      aria-label="House power draw, live">
      <LiveLineChart.Grid />
      <LiveLineChart.YAxis />
      <LiveLineChart.XAxis />
      <LiveLineChart.Line />
      <LiveLineChart.LiveDot />
      <LiveLineChart.Crosshair />
      <LiveLineChart.Tooltip variant="frosted" />
      <LiveLineChart.Table />
    </LiveLineChart.Root>
  );
}
