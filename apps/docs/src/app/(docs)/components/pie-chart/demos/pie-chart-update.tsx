"use client";

import { useState } from "react";

import { PieChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** One line of a bill: what it charges for, in kroner. */
type BillLine = { readonly part: "energy" | "rent" | "taxes" | "fee"; readonly kr: number };

// One household's electricity bill for October and November, in kroner.
const bills: readonly (readonly BillLine[])[] = [
  [
    { part: "energy", kr: 612 },
    { part: "rent", kr: 438 },
    { part: "taxes", kr: 287 },
    { part: "fee", kr: 49 },
  ],
  [
    { part: "energy", kr: 744 },
    { part: "rent", kr: 471 },
    { part: "taxes", kr: 302 },
    { part: "fee", kr: 49 },
  ],
];

const config = {
  energy: { label: "Energy", color: "chart-1" },
  rent: { label: "Grid rent", color: "chart-2" },
  taxes: { label: "Taxes", color: "chart-3" },
  fee: { label: "Monthly fee", color: "chart-4" },
} as const satisfies ChartConfig;

export function PieChartUpdate() {
  const [month, setMonth] = useState(0);
  return (
    <div className="flex w-full flex-col gap-4">
      <button type="button" className="self-start" onClick={() => setMonth(1 - month)}>
        {month === 0 ? "Show November" : "Show October"}
      </button>
      <PieChart.Root
        data={bills[month] ?? []}
        config={config}
        nameKey="part"
        valueKey="kr"
        valueFormat={{ style: "currency", currency: "NOK", maximumFractionDigits: 0 }}
        innerRadius={0.62}
        aria-label="Electricity bill">
        <PieChart.Pie />
        <PieChart.Center>
          <PieChart.CenterValue />
          <PieChart.CenterName>Total</PieChart.CenterName>
        </PieChart.Center>
        <PieChart.Tooltip />
        <PieChart.Table />
      </PieChart.Root>
    </div>
  );
}
