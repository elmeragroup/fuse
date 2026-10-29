/**
 * A directive-free server page that composes the chart entry. It holds S06's five-group stack of
 * NO1 consumption on 16 October 2026 under a `LocaleProvider`, with a series icon in the config
 * and a Headline whose text comes from `formatChartValue`, beside a `Sparkline`.
 * `rsc-chart-server.ts` renders it through Flight, and `rsc-chart-ssr.ts` renders it again with no
 * Flight, as the oracle.
 */
import type { ReactElement } from "react";

import { readFileSync } from "node:fs";

import { LocaleProvider } from "@elmeragroup/fuse";
import { Chart, formatChartValue, Sparkline } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { House } from "@elmeragroup/fuse/icons";

/** One hour of the committed Elhub fixture, in MWh per consumption group. */
type GroupHour = {
  startTime: string;
  household: number;
  cabin: number;
  primary: number;
  secondary: number;
  tertiary: number;
};

/**
 * The 24 hours a server page reads from its market data, here the package fixture that the layer
 * 05 trim script wrote from Elhub's NO1 file.
 */
function groupHours(): {
  start: Date;
  household: number;
  cabin: number;
  primary: number;
  secondary: number;
  tertiary: number;
}[] {
  const file = new URL(
    "../../../../packages/fuse/src/components/chart/format/fixtures/elhub/no1-groups-2026-10-16.json",
    import.meta.url
  );
  // SAFETY: the trim script writes this one shape, and the Flight test compares the bar count with
  // a hand-written 120, so a fixture with another shape fails an assertion.
  const { rows } = JSON.parse(readFileSync(file, "utf8")) as { rows: GroupHour[] };
  return rows.map(({ startTime, ...groups }) => ({ start: new Date(startTime), ...groups }));
}

const energy = { preset: "energy", unit: "MWh", maximumFractionDigits: 0 } as const;

const config = {
  household: { label: "Husholdninger", color: "chart-1", stack: "groups", format: energy, icon: <House /> },
  cabin: { label: "Hytter", color: "chart-2", stack: "groups", format: energy },
  primary: { label: "Primærnæring", color: "chart-3", stack: "groups", format: energy },
  secondary: { label: "Sekundærnæring", color: "chart-4", stack: "groups", format: energy },
  tertiary: { label: "Tjenesteyting", color: "chart-5", stack: "groups", format: energy },
} as const satisfies ChartConfig;

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
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <main>
        <Chart.Root
          data={groupHours()}
          config={config}
          xKey="start"
          interval="hour"
          aria-label="Forbruk per time i NO1">
          <Chart.Headline>{price.text}</Chart.Headline>
          <Chart.YAxis />
          <Chart.XAxis />
          <Chart.Bar dataKey="household" />
          <Chart.Bar dataKey="cabin" />
          <Chart.Bar dataKey="primary" />
          <Chart.Bar dataKey="secondary" />
          <Chart.Bar dataKey="tertiary" />
          <Chart.Legend>
            <Chart.LegendItem>
              <Chart.SeriesIcon />
              <Chart.SeriesLabel />
            </Chart.LegendItem>
          </Chart.Legend>
        </Chart.Root>
        <Sparkline aria-label="Spotpris i dag" data={[1.2, null, 0.8]} locale="nb-NO" />
      </main>
    </LocaleProvider>
  );
}

/** The negative control: a function crosses into a client part, which Flight must reject. */
export function FunctionFormatPage(): ReactElement {
  const format = (value: number): string => value.toFixed(1);
  return (
    <Chart.Root
      data={[{ month: "jan", kwh: 412.5 }]}
      config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
      xKey="month"
      aria-label="x">
      {/* @ts-expect-error a format is data, so the type rejects the function Flight would reject */}
      <Chart.YAxis format={format} />
    </Chart.Root>
  );
}
