"use client";

import { useEffect, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { LiveLineChart } from "@elmeragroup/fuse/chart";
import type { LiveLineChartPoint } from "@elmeragroup/fuse/chart";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

/**
 * Invented readings: an EV charger's power in kW, reported once a second, as a random walk with
 * momentum around 7.4 kW that the charger's 11 kW limit caps.
 */
function chargerWalk(): () => number {
  let kw = 7.4;
  let momentum = 0;
  return () => {
    // Momentum carries each step on, and a pull back to 7.4 kW keeps the walk near a charge rate.
    momentum = momentum * 0.85 + (Math.random() - 0.5) * 0.6 + (7.4 - kw) * 0.03;
    kw = Math.min(11, Math.max(3.5, kw + momentum));
    return Math.round(kw * 100) / 100;
  };
}

const WINDOWS = { "30s": 30_000, "1m": 60_000, "5m": 300_000 } as const;

type WindowKey = keyof typeof WINDOWS;

function windowKeyOf(value: string | undefined): WindowKey | undefined {
  return value === "30s" || value === "1m" || value === "5m" ? value : undefined;
}

export function LiveLineChartPolish() {
  const [readings, setReadings] = useState<LiveLineChartPoint[]>([]);
  useEffect(() => {
    // Five minutes of history, so every window opens full, then a reading a second.
    const next = chargerWalk();
    const start = Date.now();
    const history = Array.from({ length: 300 }, (_, index) => ({
      time: start - (300 - index) * 1000,
      value: next(),
    }));
    const first = setTimeout(() => setReadings(history), 0);
    const timer = setInterval(() => {
      // Keep more readings than the widest window shows.
      const reading = { time: Date.now(), value: next() };
      setReadings((previous) => [...previous.slice(-359), reading]);
    }, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const [windowKey, setWindowKey] = useState<WindowKey>("1m");
  const [paused, setPaused] = useState(false);
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup.Root
          variant="outline"
          size="sm"
          spacing={0}
          value={[windowKey]}
          onValueChange={(value) => {
            const picked = windowKeyOf(value[0]);
            if (picked !== undefined) setWindowKey(picked);
          }}
          aria-label="Window">
          <ToggleGroup.Item value="30s">30 s</ToggleGroup.Item>
          <ToggleGroup.Item value="1m">1 min</ToggleGroup.Item>
          <ToggleGroup.Item value="5m">5 min</ToggleGroup.Item>
        </ToggleGroup.Root>
        <Button variant="outline" size="sm" onClick={() => setPaused(!paused)}>
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>
      <LiveLineChart.Root
        data={readings}
        windowMs={WINDOWS[windowKey]}
        paused={paused}
        label="Charging power"
        color="chart-2"
        valueFormat={{ preset: "power", unit: "kW", minimumFractionDigits: 1, maximumFractionDigits: 1 }}
        timeZone="Europe/Oslo"
        aria-label="EV charging power, live">
        <LiveLineChart.Grid variant="dashed" />
        <LiveLineChart.YAxis />
        <LiveLineChart.XAxis />
        <LiveLineChart.Area />
        <LiveLineChart.Line />
        <LiveLineChart.LiveDot />
        <LiveLineChart.Badge />
        <LiveLineChart.Crosshair />
        <LiveLineChart.Tooltip variant="frosted" />
        <LiveLineChart.Table />
      </LiveLineChart.Root>
    </div>
  );
}
