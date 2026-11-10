"use client";

import { useState } from "react";

import { PieChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

/** One line of a bill: what it charges for, in kroner. */
type BillLine = { readonly part: "energy" | "rent" | "taxes" | "fee"; readonly kr: number };

type Month = "October" | "November";

// One household's electricity bill per month, in kroner.
const bills = {
  October: [
    { part: "energy", kr: 612 },
    { part: "rent", kr: 438 },
    { part: "taxes", kr: 287 },
    { part: "fee", kr: 49 },
  ],
  November: [
    { part: "energy", kr: 744 },
    { part: "rent", kr: 471 },
    { part: "taxes", kr: 302 },
    { part: "fee", kr: 49 },
  ],
} satisfies Record<Month, readonly BillLine[]>;

const config = {
  energy: { label: "Energy", color: "chart-1" },
  rent: { label: "Grid rent", color: "chart-2" },
  taxes: { label: "Taxes", color: "chart-3" },
  fee: { label: "Monthly fee", color: "chart-4" },
} as const satisfies ChartConfig;

export function PieChartBill() {
  const [month, setMonth] = useState<Month>("October");
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <ToggleGroup.Root
        aria-label="Month"
        size="sm"
        value={[month]}
        onValueChange={(value) => {
          const next = value.at(-1);
          if (next === "October" || next === "November") setMonth(next);
        }}>
        <ToggleGroup.Item value="October">October</ToggleGroup.Item>
        <ToggleGroup.Item value="November">November</ToggleGroup.Item>
      </ToggleGroup.Root>
      <PieChart.Root
        data={bills[month]}
        config={config}
        nameKey="part"
        valueKey="kr"
        valueFormat={{ style: "currency", currency: "NOK", maximumFractionDigits: 0 }}
        innerRadius={0.62}
        padAngle={1.5}
        aria-label={`Electricity bill for ${month}`}>
        <PieChart.Glow dataKey="energy" />
        <PieChart.Pie cornerRadius={0.04} />
        <PieChart.Center>
          <PieChart.CenterValue />
          <PieChart.CenterName>Total</PieChart.CenterName>
        </PieChart.Center>
        <PieChart.LegendToggleGroup />
        <PieChart.Tooltip>
          <PieChart.TooltipLabel />
          <PieChart.TooltipItems>
            <PieChart.Swatch />
            <PieChart.TooltipShare />
            <PieChart.TooltipValue />
          </PieChart.TooltipItems>
        </PieChart.Tooltip>
        <PieChart.Table />
      </PieChart.Root>
    </div>
  );
}
