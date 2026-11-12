"use client";

import { useEffect, useState } from "react";

import { LiveLineChart } from "@elmeragroup/fuse/chart";
import type { LiveLineChartPoint } from "@elmeragroup/fuse/chart";

/**
 * Invented readings: a house's power draw in kW from a meter that reports once a second, as a
 * random walk with momentum around 2.4 kW.
 */
function meterWalk(): () => number {
  let kw = 2.4;
  let momentum = 0;
  return () => {
    // Momentum carries each step on, and a pull back to 2.4 kW keeps the walk near a house's load.
    momentum = momentum * 0.8 + (Math.random() - 0.5) * 0.3 + (2.4 - kw) * 0.04;
    kw = Math.min(6, Math.max(0.4, kw + momentum));
    return Math.round(kw * 100) / 100;
  };
}

export function LiveLineChartBasic() {
  const [readings, setReadings] = useState<LiveLineChartPoint[]>([]);
  useEffect(() => {
    // A minute of history, then a reading a second.
    const next = meterWalk();
    const start = Date.now();
    const history = Array.from({ length: 60 }, (_, index) => ({
      time: start - (60 - index) * 1000,
      value: next(),
    }));
    const first = setTimeout(() => setReadings(history), 0);
    const timer = setInterval(() => {
      // Keep twice the 30 s window.
      const reading = { time: Date.now(), value: next() };
      setReadings((previous) => [...previous.slice(-119), reading]);
    }, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return (
    <LiveLineChart.Root
      data={readings}
      windowMs={30_000}
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
      <LiveLineChart.Tooltip />
      <LiveLineChart.Table />
    </LiveLineChart.Root>
  );
}
