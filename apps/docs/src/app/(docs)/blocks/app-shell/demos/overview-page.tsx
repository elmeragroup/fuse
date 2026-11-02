/**
 * The overview: four key figures, the month's consumption against last year, today's spot price by
 * the quarter-hour, a year of consumption against solar production, and the latest activity.
 *
 * A server component. The charts' parts are client components that it renders with plain data, and
 * each chart plays its entrance the first time it comes into view.
 */

import type { ReactElement } from "react";

import { Badge } from "@elmeragroup/fuse/badge";
import { BarChart, Chart, LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig, ValueFormat } from "@elmeragroup/fuse/chart";
import { Frame } from "@elmeragroup/fuse/frame";
import { TimelineList } from "@elmeragroup/fuse/timeline-list";

import { APP_LOCALE } from "./app-config";
import { KpiCard } from "./kpi-card";
import { PageHeader } from "./page-header";
import {
  ACTIVITY,
  AS_OF,
  COMPLETE_DAYS,
  DAILY_CONSUMPTION,
  DAILY_INVOICING,
  DAILY_SOLAR,
  MONTHLY_ENERGY,
  priceLevel,
  SPOT_30_DAY_AVERAGE,
  SPOT_TODAY,
  spotAt,
  TIME_ZONE,
} from "./power-data";
import type { PriceLevel } from "./power-data";

const MWH = { preset: "energy", unit: "MWh", maximumFractionDigits: 1 } as const satisfies ValueFormat;
const SPOT = {
  preset: "unit-price",
  currency: "NOK",
  minor: true,
  vat: "excluded",
  maximumFractionDigits: 1,
} as const satisfies ValueFormat;
const KR = {
  style: "currency",
  currency: "NOK",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
} as const satisfies ValueFormat;

const DAILY_CONFIG = {
  thisYear: { label: "March 2026", color: "chart-1", format: MWH },
  // Last year is the comparison: a line in the neutral role over this year's bars, so this year leads.
  lastYear: { label: "March 2025", color: "chart-other", format: MWH },
} as const satisfies ChartConfig;

const SPOT_CONFIG = {
  price: { label: "Spot price, NO1", color: "chart-1", format: SPOT },
  average: { label: "30-day average", color: "chart-other", format: SPOT },
} as const satisfies ChartConfig;

// The 30-day average rides along each quarter as a flat series, so the legend names it and the
// tooltip reads it beside the price, with no label over the line.
const SPOT_ROWS = SPOT_TODAY.map((quarter) => ({ ...quarter, average: SPOT_30_DAY_AVERAGE }));

/** The spot headline's figure, without the VAT basis, which its label carries. */
const SPOT_FIGURE = { maximumFractionDigits: 1 } as const satisfies ValueFormat;

const ENERGY_CONFIG = {
  consumption: { label: "Consumption", color: "chart-1", format: MWH },
  production: { label: "Solar production", color: "chart-3", format: MWH },
} as const satisfies ChartConfig;

const LEVELS = {
  low: { label: "Low", variant: "soft-success" },
  normal: { label: "Normal", variant: "secondary" },
  high: { label: "High", variant: "soft-warning" },
} as const satisfies Record<PriceLevel, { label: string; variant: string }>;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

// The month so far: every day whose readings are in.
const complete = DAILY_CONSUMPTION.slice(0, COMPLETE_DAYS);
const consumed = sum(complete.map((day) => day.thisYear ?? 0));
const consumedLastYear = sum(complete.map((day) => day.lastYear));
const solar = sum(DAILY_SOLAR.map((day) => day.thisYear));
const solarLastYear = sum(DAILY_SOLAR.map((day) => day.lastYear));
const spotNow = spotAt(AS_OF)?.price ?? SPOT_30_DAY_AVERAGE;
const spotSoFar = SPOT_TODAY.filter((quarter) => quarter.start <= AS_OF).map((quarter) => quarter.price);

/** "Today at 12:45 PM", "Yesterday at 4:30 PM" or a date, in Oslo. */
function whenLabel(at: Date): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, dateStyle: "short" });
  const time = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: TIME_ZONE,
    timeStyle: "short",
  });
  const yesterday = new Date(AS_OF.getTime() - 24 * 60 * 60 * 1000);
  if (day.format(at) === day.format(AS_OF)) return `Today at ${time.format(at)}`;
  if (day.format(at) === day.format(yesterday)) return `Yesterday at ${time.format(at)}`;
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone: TIME_ZONE, day: "numeric", month: "short" }).format(
    at
  );
}

const asOfLabel = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
}).format(AS_OF);

/** The overview page. */
export function OverviewPage(): ReactElement {
  const level = LEVELS[priceLevel(spotNow)];
  return (
    <>
      <PageHeader page="Overview">
        <p className="text-sm text-muted-foreground tabular-nums">
          Data as of <time dateTime={AS_OF.toISOString()}>{asOfLabel}</time>
        </p>
      </PageHeader>
      <div className="md:gap-6 md:px-6 md:pb-8 flex flex-col gap-4 p-4">
        <section
          aria-labelledby="key-figures"
          className="grid gap-4 min-[40rem]:grid-cols-2 min-[80rem]:grid-cols-4">
          <h2 id="key-figures" className="sr-only">
            Key figures
          </h2>
          <KpiCard
            label="Consumption, March 1–28"
            value={consumed}
            format={MWH}
            change={{ value: (consumed - consumedLastYear) / consumedLastYear, against: "against last year" }}
            trend={complete.map((day) => day.thisYear)}
            trendLabel="Consumption per day, March 1 to 28"
            trendVariant="bar"
          />
          <KpiCard
            label="Spot price now, NO1, excl. VAT"
            figure={{ format: SPOT_FIGURE, unit: "øre/kWh" }}
            value={spotNow}
            format={SPOT}
            badge={
              <Badge size="sm" variant={level.variant}>
                {level.label}
              </Badge>
            }
            change={{
              value: (spotNow - SPOT_30_DAY_AVERAGE) / SPOT_30_DAY_AVERAGE,
              against: "against the 30-day average",
            }}
            trend={spotSoFar}
            trendLabel="Spot price per quarter-hour today, so far"
          />
          <KpiCard
            label="Estimated invoicing, March"
            value={sum(DAILY_INVOICING)}
            format={KR}
            note="Spot plus markup, VAT included"
            trend={DAILY_INVOICING}
            trendLabel="Estimated invoicing per day, March 1 to 28"
            trendVariant="bar"
          />
          <KpiCard
            label="Solar production, March 1–28"
            value={solar}
            format={MWH}
            change={{ value: (solar - solarLastYear) / solarLastYear, against: "against last year" }}
            trend={DAILY_SOLAR.map((day) => day.thisYear)}
            trendLabel="Solar production per day, March 1 to 28"
            trendVariant="bar"
          />
        </section>

        <div className="md:gap-6 grid gap-4 min-[80rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Frame.Root>
            <Frame.Header>
              <Frame.Title>
                <h2>Consumption per day</h2>
              </Frame.Title>
              <Frame.Description>
                March so far, against March last year, across every metering point.
              </Frame.Description>
            </Frame.Header>
            <Frame.Panel className="flex-1">
              <BarChart.Root
                data={DAILY_CONSUMPTION}
                config={DAILY_CONFIG}
                xKey="day"
                interval="day"
                now={AS_OF}
                style={{ "--chart-plot-height": "15rem" }}
                aria-label="Consumption per day, March 2026 against March 2025">
                <BarChart.Grid />
                <BarChart.YAxis />
                <BarChart.XAxis />
                <BarChart.Bar dataKey="thisYear" />
                <BarChart.Line dataKey="lastYear" />
                <BarChart.Crosshair />
                <BarChart.Tooltip />
                <BarChart.LegendToggleGroup />
                <BarChart.Table />
              </BarChart.Root>
            </Frame.Panel>
          </Frame.Root>

          <Frame.Root>
            <Frame.Header>
              <Frame.Title>
                <h2>Spot price today</h2>
              </Frame.Title>
              <Frame.Description>NO1 by the quarter-hour, against the 30-day average.</Frame.Description>
            </Frame.Header>
            <Frame.Panel className="flex-1">
              <LineChart.Root
                data={SPOT_ROWS}
                config={SPOT_CONFIG}
                xKey="start"
                interval="quarter-hour"
                now={AS_OF}
                yBaseline="none"
                style={{ "--chart-plot-height": "15rem" }}
                aria-label="Spot price in NO1 per quarter-hour, March 29, 2026">
                <LineChart.Grid />
                <LineChart.YAxis />
                <LineChart.XAxis />
                <LineChart.Line dataKey="average" variant="dashed" />
                <LineChart.Line dataKey="price" curve="step-after" />
                <LineChart.Marker dataKey="price" at="now" variant="halo" />
                <LineChart.Marker dataKey="price" at="max">
                  <LineChart.ValueLabel />
                </LineChart.Marker>
                <LineChart.Crosshair />
                <LineChart.ActiveDot dataKey="price" />
                <LineChart.Tooltip />
                <LineChart.Legend />
                <LineChart.Table />
              </LineChart.Root>
            </Frame.Panel>
          </Frame.Root>
        </div>

        <div className="md:gap-6 grid gap-4 min-[80rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Frame.Root>
            <Frame.Header>
              <Frame.Title>
                <h2>Consumption and solar production</h2>
              </Frame.Title>
              <Frame.Description>
                The last twelve months. Heating peaks in winter, and the prosumers&apos; solar in summer.
              </Frame.Description>
            </Frame.Header>
            <Frame.Panel className="flex-1">
              <Chart.Root
                data={MONTHLY_ENERGY}
                config={ENERGY_CONFIG}
                xKey="month"
                interval="month"
                aria-label="Consumption and solar production per month, March 2025 to February 2026">
                <Chart.Panel series={["consumption"]}>
                  <Chart.Grid />
                  <Chart.YAxis />
                  <Chart.Crosshair variant="line" />
                  <Chart.Area dataKey="consumption" />
                  <Chart.Line dataKey="consumption" />
                </Chart.Panel>
                <Chart.Panel series={["production"]}>
                  <Chart.Grid />
                  <Chart.YAxis />
                  <Chart.Crosshair variant="line" />
                  <Chart.Area dataKey="production" />
                  <Chart.Line dataKey="production" />
                  <Chart.XAxis />
                </Chart.Panel>
                <Chart.Tooltip />
                <Chart.Legend />
                <Chart.Table />
              </Chart.Root>
            </Frame.Panel>
          </Frame.Root>

          <Frame.Root>
            <Frame.Header>
              <Frame.Title>
                <h2>Activity</h2>
              </Frame.Title>
              <Frame.Description>The latest from billing, metering and the market.</Frame.Description>
            </Frame.Header>
            <Frame.Panel className="flex-1">
              <TimelineList.Root>
                {ACTIVITY.map((entry) => (
                  <TimelineList.Item key={entry.id}>
                    <TimelineList.Title level={3}>{entry.title}</TimelineList.Title>
                    <TimelineList.Time date={entry.at}>{whenLabel(entry.at)}</TimelineList.Time>
                    <TimelineList.Description>{entry.detail}</TimelineList.Description>
                  </TimelineList.Item>
                ))}
              </TimelineList.Root>
            </Frame.Panel>
          </Frame.Root>
        </div>
      </div>
    </>
  );
}
