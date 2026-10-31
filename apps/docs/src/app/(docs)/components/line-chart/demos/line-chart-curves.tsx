"use client";

import { useState } from "react";

import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig, ChartCurve } from "@elmeragroup/fuse/chart";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

const PRICE = [62.4, 58.1, 55.7, 54.9, 57.2, 71.8, 98.4, 126.3, 119.5, 101.2, 92.8, 88.6];

/** Twelve hours from 00:00 in Oslo on 17 October 2026, which is UTC+2. */
const data = PRICE.map((price, index) => ({ hour: new Date(Date.UTC(2026, 9, 16, 22 + index)), price }));

const config = {
  price: {
    label: "Spot price",
    color: "chart-1",
    format: { preset: "unit-price", currency: "NOK", minor: true, vat: "included" },
  },
} as const satisfies ChartConfig;

const CURVES: readonly ChartCurve[] = ["monotone", "linear", "natural", "bump", "step", "step-after"];

export function LineChartCurves() {
  const [curve, setCurve] = useState<ChartCurve>("monotone");
  return (
    <div className="flex w-full flex-col gap-4">
      <ToggleGroup.Root
        aria-label="Curve"
        value={[curve]}
        onValueChange={(value: string[]) => {
          const next = CURVES.find((candidate) => candidate === value[0]);
          if (next !== undefined) setCurve(next);
        }}>
        {CURVES.map((name) => (
          <ToggleGroup.Item key={name} value={name}>
            {name}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <LineChart.Root
        data={data}
        config={config}
        xKey="hour"
        interval="hour"
        timeZone="Europe/Oslo"
        yBaseline="none"
        aria-label="Spot price tonight">
        <LineChart.Grid />
        <LineChart.YAxis />
        <LineChart.XAxis />
        <LineChart.Line dataKey="price" curve={curve} />
        <LineChart.Dots dataKey="price" variant="ring" />
        <LineChart.Crosshair />
        <LineChart.Tooltip />
      </LineChart.Root>
    </div>
  );
}
