/**
 * A directive-free server page that composes the chart entry: an empty `Chart.Root`, a `Sparkline`
 * and a Headline whose text comes from `formatChartValue`. `rsc-chart-server.ts` renders it through
 * Flight, and `rsc-chart-ssr.ts` renders it again with no Flight, as the oracle.
 */
import type { ReactElement } from "react";

import { Chart, formatChartValue, Sparkline } from "@elmeragroup/fuse/chart";

/** Hand-written rows, as a server page would read them from its market data. */
const MONTHS = [
  { month: "jan", kwh: 412.5 },
  { month: "feb", kwh: 380.1 },
] as const;

/** The spot price the headline prints, in kroner per kilowatt-hour. */
const SPOT_PRICE = 1.78;

/** The page as a server component renders it. */
export function ChartPage(): ReactElement {
  const price = formatChartValue(
    SPOT_PRICE,
    { preset: "unit-price", currency: "NOK", vat: "included" },
    { locale: "nb-NO" }
  );
  return (
    <main>
      <Chart.Root
        data={MONTHS}
        config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
        xKey="month"
        aria-label="Forbruk per måned">
        <Chart.Headline>{price.text}</Chart.Headline>
        <Chart.Bar dataKey="kwh" />
      </Chart.Root>
      <Sparkline aria-label="Spotpris i dag" data={[1.2, null, 0.8]} locale="nb-NO" />
    </main>
  );
}

/** The negative control: a function crosses into a client part, which Flight must reject. */
export function FunctionFormatPage(): ReactElement {
  const format = (value: number): string => value.toFixed(1);
  return (
    <Chart.Root
      data={MONTHS}
      config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
      xKey="month"
      aria-label="x">
      {/* @ts-expect-error a format is data, so the type rejects the function Flight would reject */}
      <Chart.YAxis format={format} />
    </Chart.Root>
  );
}
