/**
 * A directive-free server page that composes the chart entry. It holds S06's five-group stack of
 * NO1 consumption on 16 October 2026 under a `LocaleProvider`, with a series icon in the config
 * and a Headline whose text comes from `formatChartValue`, beside a `Sparkline` that a client
 * `SparklineHover` wraps.
 * `rsc-chart-server.ts` renders it through Flight, and `rsc-chart-ssr.ts` renders it again with no
 * Flight, as the oracle.
 */
import type { ReactElement } from "react";

import { readFileSync } from "node:fs";

import { LocaleProvider } from "@elmeragroup/fuse";
import {
  Chart,
  ClockChart,
  formatChartValue,
  PieChart,
  RadarChart,
  RadialChart,
  Sparkline,
  SparklineHover,
} from "@elmeragroup/fuse/chart";
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
        <SparklineHover>
          <Sparkline aria-label="Spotpris i dag" data={[1.2, null, 0.8]} locale="nb-NO" />
        </SparklineHover>
      </main>
    </LocaleProvider>
  );
}

/** One day of the committed September 2025 Elhub fixture. */
type HouseholdDay = { date: string; kwh: number };

/**
 * S12's month view as a directive-free server page: September 2025's daily household usage per
 * metering point over a price per day, in two Panels. The prices are illustrative, every one below
 * 96 øre.
 */
export function ComposedPage(): ReactElement {
  const file = new URL(
    "../../../../packages/fuse/src/components/chart/format/fixtures/elhub/no1-household-daily-2025-09.json",
    import.meta.url
  );
  // SAFETY: the trim script writes this one shape, and the Flight test compares the tick counts with
  // hand-written ones, so a fixture with another shape fails an assertion.
  const { days } = JSON.parse(readFileSync(file, "utf8")) as { days: HouseholdDay[] };
  const rows = days.map(({ date, kwh }, index) => ({
    // Oslo keeps summer time all September, so each day starts at 22:00 UTC the day before.
    start: new Date(`${date}T00:00:00+02:00`),
    kwh,
    price: 60 + ((index * 7) % 36),
  }));
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <main>
        <Chart.Root
          data={rows}
          config={{
            kwh: { label: "Forbruk", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
            price: {
              label: "Spotpris",
              color: "chart-2",
              format: { preset: "unit-price", currency: "NOK", minor: true, vat: "included" },
            },
          }}
          xKey="start"
          interval="day"
          aria-label="Forbruk og pris i september 2025">
          <Chart.Panel series={["kwh"]}>
            <Chart.YAxis />
            <Chart.Bar dataKey="kwh" />
          </Chart.Panel>
          <Chart.Panel series={["price"]}>
            <Chart.YAxis />
            <Chart.Line dataKey="price" />
            <Chart.XAxis />
          </Chart.Panel>
          <Chart.Table />
        </Chart.Root>
      </main>
    </LocaleProvider>
  );
}

/** October's bill in kroner, 1 200 in all. */
const BILL = [
  { part: "strom", kr: 612 },
  { part: "nettleie", kr: 348 },
  { part: "avgifter", kr: 240 },
];

/** A day's mean spot price in three price areas, in øre per kilowatt-hour. */
const AREAS = [
  { area: "no1", ore: 92 },
  { area: "no2", ore: 88 },
  { area: "no4", ore: 31 },
];

/** Each season's mean spot price in NO1 and NO4, in øre per kilowatt-hour. */
const SEASONS = [
  { season: "Vinter", no1: 120, no4: 45 },
  { season: "Vår", no1: 80, no4: 30 },
  { season: "Sommer", no1: 40, no4: 20 },
  { season: "Høst", no1: 95, no4: 38 },
];

/** A household's day in Oslo, 25 October 2025, one reading an hour from 1 to 4 kWh. */
const CLOCK_DAY = Array.from({ length: 24 }, (_, hour) => ({
  start: Date.parse("2025-10-24T22:00:00Z") + hour * 3_600_000,
  kwh: 1 + (hour % 4),
}));

/**
 * The polar Roots as a directive-free server page: a bill as a pie with its slices, labels, legend and table,
 * three price areas as rings against 150 øre with their table, and two areas' seasons as a radar
 * with its grid, axes, one area's fill and outline, and its legend, and a household's day as a clock
 * with its grid, labels, columns, line and centre.
 */
export function PolarPage(): ReactElement {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <main>
        <PieChart.Root
          data={BILL}
          config={{
            strom: { label: "Strøm", color: "chart-1" },
            nettleie: { label: "Nettleie", color: "chart-2" },
            avgifter: { label: "Avgifter", color: "chart-3" },
          }}
          nameKey="part"
          valueKey="kr"
          aria-label="Strømregning i oktober">
          <PieChart.Pie />
          <PieChart.Labels />
          <PieChart.Legend />
          <PieChart.Table />
        </PieChart.Root>
        <RadialChart.Root
          data={AREAS}
          config={{
            no1: { label: "NO1", color: "chart-1" },
            no2: { label: "NO2", color: "chart-2" },
            no4: { label: "NO4", color: "chart-4" },
          }}
          nameKey="area"
          valueKey="ore"
          max={150}
          aria-label="Spotpris per område">
          <RadialChart.Track />
          <RadialChart.Bar />
          <RadialChart.Table />
        </RadialChart.Root>
        <RadarChart.Root
          data={SEASONS}
          config={{ no1: { label: "NO1", color: "chart-1" }, no4: { label: "NO4", color: "chart-4" } }}
          nameKey="season"
          aria-label="Spotpris per sesong">
          <RadarChart.Grid />
          <RadarChart.AngleAxis />
          <RadarChart.RadiusAxis />
          <RadarChart.Area dataKey="no1" />
          <RadarChart.Line dataKey="no1" />
          <RadarChart.Legend />
        </RadarChart.Root>
        <ClockChart.Root
          data={CLOCK_DAY}
          config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
          xKey="start"
          cycle="day"
          interval="hour"
          aria-label="Forbruk per time">
          <ClockChart.Grid />
          <ClockChart.AngleAxis />
          <ClockChart.Column dataKey="kwh" />
          <ClockChart.Line dataKey="kwh" />
          <ClockChart.Center />
        </ClockChart.Root>
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
