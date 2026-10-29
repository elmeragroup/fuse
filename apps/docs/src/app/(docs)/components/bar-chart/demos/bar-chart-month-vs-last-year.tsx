"use client";

import { useState } from "react";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { LocaleProvider, ThemeScope, useTheme } from "@elmeragroup/fuse/theme";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

// NO1 household consumption per metering point and day in October 2025, computed from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_HOUSEHOLD_DAILY_2025_10 = [
  { date: "2025-10-01", kwh: 32.33, peakKwh: 1.6113, peakStart: "2025-10-01T20:00:00+02:00" },
  { date: "2025-10-02", kwh: 31.47, peakKwh: 1.5665, peakStart: "2025-10-02T19:00:00+02:00" },
  { date: "2025-10-03", kwh: 31.2, peakKwh: 1.5697, peakStart: "2025-10-03T19:00:00+02:00" },
  { date: "2025-10-04", kwh: 34.64, peakKwh: 1.7345, peakStart: "2025-10-04T18:00:00+02:00" },
  { date: "2025-10-05", kwh: 34.1, peakKwh: 1.7011, peakStart: "2025-10-05T19:00:00+02:00" },
  { date: "2025-10-06", kwh: 32.35, peakKwh: 1.6419, peakStart: "2025-10-06T20:00:00+02:00" },
  { date: "2025-10-07", kwh: 31.7, peakKwh: 1.6087, peakStart: "2025-10-07T20:00:00+02:00" },
  { date: "2025-10-08", kwh: 30.66, peakKwh: 1.5927, peakStart: "2025-10-08T20:00:00+02:00" },
  { date: "2025-10-09", kwh: 33.58, peakKwh: 1.6927, peakStart: "2025-10-09T20:00:00+02:00" },
  { date: "2025-10-10", kwh: 33.93, peakKwh: 1.616, peakStart: "2025-10-10T19:00:00+02:00" },
  { date: "2025-10-11", kwh: 31.09, peakKwh: 1.5193, peakStart: "2025-10-11T18:00:00+02:00" },
  { date: "2025-10-12", kwh: 32.46, peakKwh: 1.7467, peakStart: "2025-10-12T20:00:00+02:00" },
  { date: "2025-10-13", kwh: 34.9, peakKwh: 1.747, peakStart: "2025-10-13T20:00:00+02:00" },
  { date: "2025-10-14", kwh: 32.33, peakKwh: 1.6205, peakStart: "2025-10-14T20:00:00+02:00" },
  { date: "2025-10-15", kwh: 33.33, peakKwh: 1.693, peakStart: "2025-10-15T20:00:00+02:00" },
  { date: "2025-10-16", kwh: 35.48, peakKwh: 1.8259, peakStart: "2025-10-16T21:00:00+02:00" },
  { date: "2025-10-17", kwh: 38.82, peakKwh: 1.8846, peakStart: "2025-10-17T19:00:00+02:00" },
  { date: "2025-10-18", kwh: 41.91, peakKwh: 1.9612, peakStart: "2025-10-18T19:00:00+02:00" },
  { date: "2025-10-19", kwh: 44.59, peakKwh: 2.1451, peakStart: "2025-10-19T20:00:00+02:00" },
  { date: "2025-10-20", kwh: 42.75, peakKwh: 2.0702, peakStart: "2025-10-20T18:00:00+02:00" },
  { date: "2025-10-21", kwh: 40.29, peakKwh: 1.9736, peakStart: "2025-10-21T18:00:00+02:00" },
  { date: "2025-10-22", kwh: 36.65, peakKwh: 1.7952, peakStart: "2025-10-22T18:00:00+02:00" },
  { date: "2025-10-23", kwh: 34.61, peakKwh: 1.7577, peakStart: "2025-10-23T19:00:00+02:00" },
  { date: "2025-10-24", kwh: 35.44, peakKwh: 1.7922, peakStart: "2025-10-24T18:00:00+02:00" },
  { date: "2025-10-25", kwh: 35.63, peakKwh: 1.7781, peakStart: "2025-10-25T18:00:00+02:00" },
  { date: "2025-10-26", kwh: 39.04, peakKwh: 1.8986, peakStart: "2025-10-26T18:00:00+01:00" },
  { date: "2025-10-27", kwh: 37.74, peakKwh: 1.9086, peakStart: "2025-10-27T19:00:00+01:00" },
  { date: "2025-10-28", kwh: 41.16, peakKwh: 2.0672, peakStart: "2025-10-28T20:00:00+01:00" },
  { date: "2025-10-29", kwh: 42.4, peakKwh: 2.0717, peakStart: "2025-10-29T18:00:00+01:00" },
  { date: "2025-10-30", kwh: 42.78, peakKwh: 2.1539, peakStart: "2025-10-30T20:00:00+01:00" },
  { date: "2025-10-31", kwh: 46.34, peakKwh: 2.218, peakStart: "2025-10-31T17:00:00+01:00" },
];

// NO1 household consumption per metering point and day in October 2024, computed from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_HOUSEHOLD_DAILY_2024_10 = [
  { date: "2024-10-01", kwh: 32.06 },
  { date: "2024-10-02", kwh: 32.24 },
  { date: "2024-10-03", kwh: 31.89 },
  { date: "2024-10-04", kwh: 32.78 },
  { date: "2024-10-05", kwh: 32.62 },
  { date: "2024-10-06", kwh: 32.37 },
  { date: "2024-10-07", kwh: 33.18 },
  { date: "2024-10-08", kwh: 32.64 },
  { date: "2024-10-09", kwh: 31.29 },
  { date: "2024-10-10", kwh: 32.45 },
  { date: "2024-10-11", kwh: 35.73 },
  { date: "2024-10-12", kwh: 39.91 },
  { date: "2024-10-13", kwh: 38.44 },
  { date: "2024-10-14", kwh: 38.61 },
  { date: "2024-10-15", kwh: 40.51 },
  { date: "2024-10-16", kwh: 40.22 },
  { date: "2024-10-17", kwh: 37.73 },
  { date: "2024-10-18", kwh: 35.44 },
  { date: "2024-10-19", kwh: 33.65 },
  { date: "2024-10-20", kwh: 34.11 },
  { date: "2024-10-21", kwh: 31.89 },
  { date: "2024-10-22", kwh: 33.84 },
  { date: "2024-10-23", kwh: 35.7 },
  { date: "2024-10-24", kwh: 33.67 },
  { date: "2024-10-25", kwh: 34.9 },
  { date: "2024-10-26", kwh: 36.65 },
  { date: "2024-10-27", kwh: 37.83 },
  { date: "2024-10-28", kwh: 36.7 },
  { date: "2024-10-29", kwh: 40.1 },
  { date: "2024-10-30", kwh: 39.03 },
  { date: "2024-10-31", kwh: 37.22 },
];

/** Oslo midnight of a calendar date, in summer time up to the last Sunday of October. */
function osloMidnight(date: string, summerUntil: string): Date {
  return new Date(`${date}T00:00:00${date <= summerUntil ? "+02:00" : "+01:00"}`);
}

const days = NO1_HOUSEHOLD_DAILY_2025_10.map((row, index) => {
  const lastYear = NO1_HOUSEHOLD_DAILY_2024_10[index]?.kwh ?? null;
  return {
    day: osloMidnight(row.date, "2025-10-26"),
    thisYear: row.kwh,
    lastYear,
    change: lastYear === null ? null : (row.kwh - lastYear) / lastYear,
  };
});

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

const config = {
  thisYear: { label: "October 2025", color: "chart-1", format: energy },
  lastYear: { label: "October 2024", color: "chart-2", format: energy },
} as const satisfies ChartConfig;

/** The locales the demo's switch offers. The chart's own text follows the picked one. */
const LOCALES = [
  { code: "en-US", label: "English", lang: "en" },
  { code: "nb-NO", label: "Norsk", lang: "nb" },
] as const satisfies readonly { code: SupportedLocale; label: string; lang: string }[];

export function BarChartMonthVsLastYear() {
  const [locale, setLocale] = useState<SupportedLocale>("en-US");
  const theme = useTheme();
  return (
    <LocaleProvider locale={locale}>
      {/* A nested ThemeScope holds the tooltip's portal, so the popup takes the picked language too. */}
      <ThemeScope
        theme={theme}
        className="flex w-full flex-col gap-4"
        lang={LOCALES.find((option) => option.code === locale)?.lang ?? "en"}>
        <ToggleGroup.Root
          aria-label="Language"
          value={[locale]}
          onValueChange={(value: string[]) => {
            const next = LOCALES.find((option) => option.code === value[0]);
            if (next !== undefined) setLocale(next.code);
          }}>
          {LOCALES.map((option) => (
            <ToggleGroup.Item key={option.code} value={option.code} lang={option.lang}>
              {option.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        <BarChart.Root
          data={days}
          config={config}
          xKey="day"
          interval="day"
          timeZone="Europe/Oslo"
          aria-label="Household consumption per day, October 2025 against October 2024">
          <BarChart.Grid />
          <BarChart.YAxis />
          <BarChart.XAxis />
          <BarChart.BarGroup series={["thisYear", "lastYear"]}>
            <BarChart.Bar dataKey="thisYear" />
            <BarChart.Bar dataKey="lastYear" variant="hatched" />
          </BarChart.BarGroup>
          <BarChart.Tooltip />
          <BarChart.LegendToggleGroup />
          <BarChart.Table>
            <BarChart.TableColumn
              dataKey="change"
              header="Change"
              format={{ style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }}
            />
          </BarChart.Table>
        </BarChart.Root>
      </ThemeScope>
    </LocaleProvider>
  );
}
