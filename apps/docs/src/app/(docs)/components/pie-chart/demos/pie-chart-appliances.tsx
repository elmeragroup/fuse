"use client";

import { PieChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One household's yearly consumption per appliance, in kilowatt-hours.
const use = [
  { appliance: "heating", kwh: 4120 },
  { appliance: "water", kwh: 2310 },
  { appliance: "car", kwh: 1680 },
  { appliance: "cooking", kwh: 540 },
  { appliance: "washing", kwh: 410 },
  { appliance: "lighting", kwh: 330 },
  { appliance: "fridge", kwh: 290 },
  { appliance: "electronics", kwh: 260 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const config = {
  heating: { label: "Heating", color: "chart-1", format: energy },
  water: { label: "Water heater", color: "chart-2", format: energy },
  car: { label: "Car charging", color: "chart-3", format: energy },
  cooking: { label: "Cooking", color: "chart-4", format: energy },
  washing: { label: "Washing", color: "chart-5", format: energy },
  lighting: { label: "Lighting", color: "chart-6", format: energy },
  fridge: { label: "Fridge", color: "chart-7", format: energy },
  electronics: { label: "Electronics", color: "chart-8", format: energy },
} as const satisfies ChartConfig;

export function PieChartAppliances() {
  return (
    <PieChart.Root
      data={use}
      config={config}
      nameKey="appliance"
      valueKey="kwh"
      maxSlices={5}
      aria-label="Consumption per appliance this year">
      <PieChart.Pie />
      <PieChart.Labels position="inside">
        <PieChart.LegendShare />
      </PieChart.Labels>
      <PieChart.Legend side="end" />
      <PieChart.Tooltip />
      <PieChart.Table />
    </PieChart.Root>
  );
}
