"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One household's consumption and its rooftop solar production per month.
const data = [
  { month: "January", consumption: 2412, production: 38 },
  { month: "February", consumption: 2168, production: 142 },
  { month: "March", consumption: 1893, production: 356 },
  { month: "April", consumption: 1447, production: 528 },
  { month: "May", consumption: 1062, production: 664 },
  { month: "June", consumption: 806, production: 702 },
  { month: "July", consumption: 731, production: 668 },
  { month: "August", consumption: 788, production: 541 },
  { month: "September", consumption: 1004, production: 372 },
  { month: "October", consumption: 1458, production: 196 },
  { month: "November", consumption: 1917, production: 62 },
  { month: "December", consumption: 2296, production: 21 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const VARIANTS = ["hatched", "duotone", "gradient", "striped"] as const;

/** The consumption bars in one look, and the production line. */
function configIn(variant: (typeof VARIANTS)[number]) {
  return {
    consumption: { label: "Consumption", color: "chart-1", format: energy, barVariant: variant },
    production: { label: "Solar production", color: "chart-2", format: energy },
  } as const satisfies ChartConfig;
}

/** Each tinted look of `Chart.Bar` under a Line, one chart per look. */
export function ChartComposedVariants() {
  return (
    <div className="sm:grid-cols-2 grid w-full gap-6">
      {VARIANTS.map((variant) => (
        <Chart.Root
          key={variant}
          data={data}
          config={configIn(variant)}
          xKey="month"
          style={{ "--chart-plot-height": "8rem" }}
          aria-label={`Consumption and solar production per month, ${variant} bars`}>
          <Chart.Grid />
          <Chart.XAxis />
          <Chart.Bar dataKey="consumption" />
          <Chart.Line dataKey="production" />
          <Chart.Legend />
          <Chart.Tooltip />
          <Chart.Table />
        </Chart.Root>
      ))}
    </div>
  );
}
