"use client";

import { useState } from "react";

import { tableFeatures } from "@tanstack/react-table";

import { Chart, Sparkline } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { createFuseTableHook } from "@elmeragroup/fuse/data-table";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

import { HOURLY_AUTUMN_KWH, HOURLY_AUTUMN_START } from "./data/no1-household-hourly-2025-09-2025-10";

// NO1 household consumption per metering point and day, September and October 2025, computed from
// the Elhub dataset CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its
// datasets under CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_HOUSEHOLD_DAILY_2025_09 = [
  { date: "2025-09-01", kwh: 22.9 },
  { date: "2025-09-02", kwh: 22.35 },
  { date: "2025-09-03", kwh: 22.58 },
  { date: "2025-09-04", kwh: 22.46 },
  { date: "2025-09-05", kwh: 22.66 },
  { date: "2025-09-06", kwh: 22.7 },
  { date: "2025-09-07", kwh: 24.06 },
  { date: "2025-09-08", kwh: 23.29 },
  { date: "2025-09-09", kwh: 22.52 },
  { date: "2025-09-10", kwh: 22.29 },
  { date: "2025-09-11", kwh: 23.39 },
  { date: "2025-09-12", kwh: 24.22 },
  { date: "2025-09-13", kwh: 25.79 },
  { date: "2025-09-14", kwh: 27.33 },
  { date: "2025-09-15", kwh: 27.11 },
  { date: "2025-09-16", kwh: 26.17 },
  { date: "2025-09-17", kwh: 25.23 },
  { date: "2025-09-18", kwh: 25.97 },
  { date: "2025-09-19", kwh: 25.86 },
  { date: "2025-09-20", kwh: 25.82 },
  { date: "2025-09-21", kwh: 27.68 },
  { date: "2025-09-22", kwh: 28.55 },
  { date: "2025-09-23", kwh: 30.33 },
  { date: "2025-09-24", kwh: 30.3 },
  { date: "2025-09-25", kwh: 30.7 },
  { date: "2025-09-26", kwh: 30.53 },
  { date: "2025-09-27", kwh: 29.92 },
  { date: "2025-09-28", kwh: 30.23 },
  { date: "2025-09-29", kwh: 28.77 },
  { date: "2025-09-30", kwh: 29.75 },
];

export const NO1_HOUSEHOLD_DAILY_2025_10 = [
  { date: "2025-10-01", kwh: 32.33 },
  { date: "2025-10-02", kwh: 31.47 },
  { date: "2025-10-03", kwh: 31.2 },
  { date: "2025-10-04", kwh: 34.64 },
  { date: "2025-10-05", kwh: 34.1 },
  { date: "2025-10-06", kwh: 32.35 },
  { date: "2025-10-07", kwh: 31.7 },
  { date: "2025-10-08", kwh: 30.66 },
  { date: "2025-10-09", kwh: 33.58 },
  { date: "2025-10-10", kwh: 33.93 },
  { date: "2025-10-11", kwh: 31.09 },
  { date: "2025-10-12", kwh: 32.46 },
  { date: "2025-10-13", kwh: 34.9 },
  { date: "2025-10-14", kwh: 32.33 },
  { date: "2025-10-15", kwh: 33.33 },
  { date: "2025-10-16", kwh: 35.48 },
  { date: "2025-10-17", kwh: 38.82 },
  { date: "2025-10-18", kwh: 41.91 },
  { date: "2025-10-19", kwh: 44.59 },
  { date: "2025-10-20", kwh: 42.75 },
  { date: "2025-10-21", kwh: 40.29 },
  { date: "2025-10-22", kwh: 36.65 },
  { date: "2025-10-23", kwh: 34.61 },
  { date: "2025-10-24", kwh: 35.44 },
  { date: "2025-10-25", kwh: 35.63 },
  { date: "2025-10-26", kwh: 39.04 },
  { date: "2025-10-27", kwh: 37.74 },
  { date: "2025-10-28", kwh: 41.16 },
  { date: "2025-10-29", kwh: 42.4 },
  { date: "2025-10-30", kwh: 42.78 },
  { date: "2025-10-31", kwh: 46.34 },
];

// Illustrative spot prices in øre per kWh with VAT, typed by hand, so they carry no market data:
// one per day of September and October 2025, and one per hour of 26 October 2025, which has 25.
const PRICE_SEPTEMBER = [
  71.0, 89.6, 101.8, 104.4, 98.8, 74.9, 68.2, 81.7, 84.1, 86.0, 82.5, 71.4, 40.0, 24.1, 29.9, 31.2, 42.2,
  57.8, 71.6, 64.1, 65.1, 78.2, 78.2, 83.6, 93.5, 103.6, 92.9, 87.5, 87.8, 68.6,
];
const PRICE_OCTOBER = [
  51.6, 42.3, 42.2, 33.2, 39.9, 57.9, 55.9, 51.9, 51.1, 57.6, 56.8, 74.9, 105.2, 112.0, 108.1, 96.2, 82.1,
  56.6, 52.4, 68.2, 69.2, 66.0, 56.9, 44.5, 19.3, 17.0, 40.2, 56.6, 75.4, 89.9, 96.1,
];
const PRICE_26_OCTOBER = [
  66.6, 57.5, 50.6, 48.0, 50.6, 57.5, 66.6, 75.3, 80.9, 81.7, 77.5, 69.5, 60.2, 52.3, 48.3, 49.2, 77.0, 85.7,
  94.8, 101.6, 82.0, 79.3, 72.2, 63.0, 54.4,
];

const HOUR = 3_600_000;

/** Oslo midnight of a date, which sits at 22:00 UTC the day before in summer time and 23:00 after. */
function osloMidnight(date: string): Date {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  // Summer time ends on 26 October 2025, so later days start an hour later in UTC.
  const offset = month < 10 || (month === 10 && day <= 26) ? 2 : 1;
  return new Date(Date.UTC(year, month - 1, day, -offset));
}

/** The start of the next day in Oslo, which ends `date`. */
function dayEnd(date: string): Date {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return osloMidnight(new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10));
}

/** The hourly values of one Oslo day, from the hour its midnight starts to the next day's. */
function hoursOf(date: string): number[] {
  const first = (osloMidnight(date).getTime() - Date.parse(HOURLY_AUTUMN_START)) / HOUR;
  const last = (dayEnd(date).getTime() - Date.parse(HOURLY_AUTUMN_START)) / HOUR;
  return HOURLY_AUTUMN_KWH.slice(first, last);
}

/**
 * Noon on 31 October 2025 in Oslo. That day's spot price is known a day ahead, but its consumption
 * arrives after the day ends, so its usage is pending.
 */
const OCTOBER_NOW = new Date(Date.UTC(2025, 9, 31, 11));

type Day = { readonly date: string; readonly kwh: number | null };

/** Each day's usage, which stays pending until the day ends at `now`. */
function daysUntil(days: readonly Day[], now: Date | undefined): Day[] {
  return days.map(({ date, kwh }) => ({ date, kwh: now !== undefined && dayEnd(date) > now ? null : kwh }));
}

function monthOf(name: string, days: readonly Day[], prices: readonly number[], now: Date | undefined) {
  const listed = daysUntil(days, now);
  return {
    name,
    now,
    rows: listed.map(({ date, kwh }, index) => ({
      start: osloMidnight(date),
      kwh,
      price: prices[index] ?? null,
    })),
    days: listed,
  };
}

const MONTHS = {
  september: monthOf("September 2025", NO1_HOUSEHOLD_DAILY_2025_09, PRICE_SEPTEMBER, undefined),
  october: monthOf("October 2025", NO1_HOUSEHOLD_DAILY_2025_10, PRICE_OCTOBER, OCTOBER_NOW),
};

/** The 25 hours of 26 October 2025, whose second 02:00 hour repeats after the clocks go back. */
const FALL_BACK_HOURS = hoursOf("2025-10-26").map((kwh, index) => ({
  start: new Date(osloMidnight("2025-10-26").getTime() + index * HOUR),
  kwh,
  price: PRICE_26_OCTOBER[index] ?? null,
}));

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 2 } as const;

const config = {
  kwh: { label: "Usage", color: "chart-1", format: energy },
  price: {
    label: "Spot price, illustrative",
    color: "chart-2",
    format: { preset: "unit-price", currency: "NOK", minor: true, vat: "included" },
  },
} as const satisfies ChartConfig;

type View = "september" | "october" | "day";

const { useAppTable: useDayTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({}),
});

const columns = createAppColumnHelper<Day>();

const DAY_COLUMNS = columns.columns([
  columns.accessor("date", { header: "Day", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("kwh", {
    header: "Usage (kWh)",
    cell: ({ cell, row }) => (row.original.kwh === null ? "Pending" : <cell.NumberCell />),
  }),
  columns.display({
    id: "hours",
    header: "Hours",
    // A pending day has no metered hours yet.
    cell: ({ row }) =>
      row.original.kwh === null ? null : (
        <Sparkline
          className="w-40"
          aria-label={`Usage per hour on ${row.original.date}`}
          data={hoursOf(row.original.date)}
          locale="en-US"
          format={energy}
          emphasis="max"
        />
      ),
  }),
]);

/**
 * Usage per day over an illustrative daily spot price, for September or October 2025, and the 25
 * hours of 26 October. Both Panels share one x grid, and the legend's toggles select a series in
 * either Panel. October stops at noon on its last day, whose price is known and whose usage is
 * pending. A data table below lists each day, with a Sparkline of its hours from a cell renderer.
 */
export function ChartMonthUsageAndPrice() {
  const [view, setView] = useState<View>("october");
  const month = view === "september" ? MONTHS.september : MONTHS.october;
  const rows = view === "day" ? FALL_BACK_HOURS : month.rows;
  const name = view === "day" ? "26 October 2025" : month.name;
  const table = useDayTable({ columns: DAY_COLUMNS, data: month.days });
  return (
    <div className="flex w-full flex-col gap-4">
      <ToggleGroup.Root
        aria-label="Period"
        value={[view]}
        onValueChange={(value: string[]) => {
          const next = value[0];
          if (next === "september" || next === "october" || next === "day") setView(next);
        }}>
        <ToggleGroup.Item value="september">September</ToggleGroup.Item>
        <ToggleGroup.Item value="october">October</ToggleGroup.Item>
        <ToggleGroup.Item value="day">26 October by hour</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Chart.Root
        data={rows}
        config={config}
        xKey="start"
        interval={view === "day" ? "hour" : "day"}
        timeZone="Europe/Oslo"
        now={view === "day" ? undefined : month.now}
        aria-label={`Usage and illustrative spot price, ${name}`}>
        <Chart.Panel series={["kwh"]}>
          <Chart.Grid />
          <Chart.YAxis />
          <Chart.Crosshair />
          <Chart.Bar dataKey="kwh" />
        </Chart.Panel>
        <Chart.Panel series={["price"]}>
          <Chart.Grid />
          <Chart.YAxis />
          <Chart.Crosshair variant="line" />
          <Chart.Line dataKey="price" />
          <Chart.ActiveDot dataKey="price" />
          <Chart.XAxis />
        </Chart.Panel>
        <Chart.Tooltip />
        <Chart.LegendToggleGroup />
        <Chart.Table />
      </Chart.Root>
      {view === "day" ? null : (
        <table.AppTable>
          <table.Content aria-label={`Usage per day, ${name}`} />
        </table.AppTable>
      )}
    </div>
  );
}
