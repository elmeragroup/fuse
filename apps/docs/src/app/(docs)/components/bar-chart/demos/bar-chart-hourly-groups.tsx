"use client";

import { useState } from "react";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { LocaleProvider, ThemeScope, useTheme } from "@elmeragroup/fuse/theme";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

// NO1 consumption per consumption group and hour on 16 October 2026, in MWh, computed from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_GROUPS_2026_10_16 = [
  {
    startTime: "2026-10-16T00:00:00+02:00",
    household: 1508.764,
    cabin: 73.413,
    primary: 34.091,
    secondary: 491.917,
    tertiary: 877.003,
  },
  {
    startTime: "2026-10-16T01:00:00+02:00",
    household: 1390.568,
    cabin: 72.548,
    primary: 33.996,
    secondary: 485.579,
    tertiary: 854.471,
  },
  {
    startTime: "2026-10-16T02:00:00+02:00",
    household: 1323.137,
    cabin: 72.46,
    primary: 34.48,
    secondary: 480.794,
    tertiary: 842.146,
  },
  {
    startTime: "2026-10-16T03:00:00+02:00",
    household: 1284.84,
    cabin: 72.429,
    primary: 36.842,
    secondary: 489.266,
    tertiary: 839.089,
  },
  {
    startTime: "2026-10-16T04:00:00+02:00",
    household: 1277.306,
    cabin: 72.588,
    primary: 38.782,
    secondary: 487.761,
    tertiary: 855.808,
  },
  {
    startTime: "2026-10-16T05:00:00+02:00",
    household: 1311.858,
    cabin: 73.636,
    primary: 40.112,
    secondary: 497.266,
    tertiary: 938.144,
  },
  {
    startTime: "2026-10-16T06:00:00+02:00",
    household: 1453.704,
    cabin: 75.359,
    primary: 43.891,
    secondary: 561.49,
    tertiary: 1112.819,
  },
  {
    startTime: "2026-10-16T07:00:00+02:00",
    household: 1635.565,
    cabin: 78.52,
    primary: 50.177,
    secondary: 632.958,
    tertiary: 1311.993,
  },
  {
    startTime: "2026-10-16T08:00:00+02:00",
    household: 1635.339,
    cabin: 80.606,
    primary: 52.172,
    secondary: 651.352,
    tertiary: 1424.15,
  },
  {
    startTime: "2026-10-16T09:00:00+02:00",
    household: 1605.342,
    cabin: 80.924,
    primary: 51.488,
    secondary: 653.48,
    tertiary: 1473.159,
  },
  {
    startTime: "2026-10-16T10:00:00+02:00",
    household: 1574.773,
    cabin: 79.833,
    primary: 48.949,
    secondary: 647.782,
    tertiary: 1481.156,
  },
  {
    startTime: "2026-10-16T11:00:00+02:00",
    household: 1546.737,
    cabin: 77.848,
    primary: 45.975,
    secondary: 632.051,
    tertiary: 1455.244,
  },
  {
    startTime: "2026-10-16T12:00:00+02:00",
    household: 1546.604,
    cabin: 76.795,
    primary: 46.906,
    secondary: 627.169,
    tertiary: 1460.234,
  },
  {
    startTime: "2026-10-16T13:00:00+02:00",
    household: 1566.578,
    cabin: 76.866,
    primary: 47.856,
    secondary: 623.198,
    tertiary: 1455.528,
  },
  {
    startTime: "2026-10-16T14:00:00+02:00",
    household: 1607.275,
    cabin: 77.47,
    primary: 47.749,
    secondary: 589.502,
    tertiary: 1434.774,
  },
  {
    startTime: "2026-10-16T15:00:00+02:00",
    household: 1692.877,
    cabin: 78.896,
    primary: 47.386,
    secondary: 565.893,
    tertiary: 1388.408,
  },
  {
    startTime: "2026-10-16T16:00:00+02:00",
    household: 1827.078,
    cabin: 81.954,
    primary: 45.326,
    secondary: 527.025,
    tertiary: 1315.493,
  },
  {
    startTime: "2026-10-16T17:00:00+02:00",
    household: 1910.023,
    cabin: 87.901,
    primary: 46.349,
    secondary: 504.611,
    tertiary: 1245.745,
  },
  {
    startTime: "2026-10-16T18:00:00+02:00",
    household: 1997.781,
    cabin: 97.34,
    primary: 47.341,
    secondary: 502.45,
    tertiary: 1250.212,
  },
  {
    startTime: "2026-10-16T19:00:00+02:00",
    household: 2025.464,
    cabin: 102.811,
    primary: 46.431,
    secondary: 495.872,
    tertiary: 1226.654,
  },
  {
    startTime: "2026-10-16T20:00:00+02:00",
    household: 1990.839,
    cabin: 103.856,
    primary: 44.959,
    secondary: 487.003,
    tertiary: 1176.871,
  },
  {
    startTime: "2026-10-16T21:00:00+02:00",
    household: 1948.121,
    cabin: 103.452,
    primary: 42.059,
    secondary: 476.092,
    tertiary: 1124.821,
  },
  {
    startTime: "2026-10-16T22:00:00+02:00",
    household: 1917.934,
    cabin: 102.577,
    primary: 39.06,
    secondary: 473.336,
    tertiary: 1060.101,
  },
  {
    startTime: "2026-10-16T23:00:00+02:00",
    household: 1835.485,
    cabin: 100.565,
    primary: 37.197,
    secondary: 472.646,
    tertiary: 1003.998,
  },
];

const hours = NO1_GROUPS_2026_10_16.map((row) => ({ ...row, start: new Date(row.startTime) }));

const energy = { preset: "energy", unit: "MWh", maximumFractionDigits: 0 } as const;

const config = {
  household: { label: "Households", color: "chart-1", stack: "groups", format: energy },
  cabin: { label: "Cabins", color: "chart-2", stack: "groups", format: energy },
  primary: { label: "Primary industry", color: "chart-3", stack: "groups", format: energy },
  secondary: { label: "Secondary industry", color: "chart-4", stack: "groups", format: energy },
  tertiary: { label: "Services", color: "chart-5", stack: "groups", format: energy },
} as const satisfies ChartConfig;

/** The locales the demo's switch offers. The chart's own text follows the picked one. */
const LOCALES = [
  { code: "en-US", label: "English", lang: "en" },
  { code: "nb-NO", label: "Norsk", lang: "nb" },
] as const satisfies readonly { code: SupportedLocale; label: string; lang: string }[];

export function BarChartHourlyGroups() {
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
          data={hours}
          config={config}
          xKey="start"
          interval="hour"
          timeZone="Europe/Oslo"
          aria-label="NO1 consumption per hour by group, 16 October 2026">
          <BarChart.Grid />
          <BarChart.YAxis />
          <BarChart.XAxis />
          <BarChart.Bar dataKey="household" />
          <BarChart.Bar dataKey="cabin" />
          <BarChart.Bar dataKey="primary" />
          <BarChart.Bar dataKey="secondary" />
          <BarChart.Bar dataKey="tertiary" />
          <BarChart.Tooltip />
          <BarChart.LegendToggleGroup />
          <BarChart.Table />
        </BarChart.Root>
      </ThemeScope>
    </LocaleProvider>
  );
}
