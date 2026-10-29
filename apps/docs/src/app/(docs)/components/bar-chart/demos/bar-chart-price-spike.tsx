"use client";

import { useState } from "react";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { LocaleProvider, ThemeScope, useTheme } from "@elmeragroup/fuse/theme";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

// An invented SE3 spot price day in SEK per kWh, 24 May 2026, with negative quarters around midday
// and one evening spike. It follows the elprisetjustnu.se file shape, and every value is typed by
// hand, so it carries no market data.
export const PRICE_DAY_2026_05_24 = [
  { time_start: "2026-05-24T00:00:00+02:00", SEK_per_kWh: 0.36 },
  { time_start: "2026-05-24T00:15:00+02:00", SEK_per_kWh: 0.37 },
  { time_start: "2026-05-24T00:30:00+02:00", SEK_per_kWh: 0.355 },
  { time_start: "2026-05-24T00:45:00+02:00", SEK_per_kWh: 0.375 },
  { time_start: "2026-05-24T01:00:00+02:00", SEK_per_kWh: 0.33 },
  { time_start: "2026-05-24T01:15:00+02:00", SEK_per_kWh: 0.34 },
  { time_start: "2026-05-24T01:30:00+02:00", SEK_per_kWh: 0.325 },
  { time_start: "2026-05-24T01:45:00+02:00", SEK_per_kWh: 0.345 },
  { time_start: "2026-05-24T02:00:00+02:00", SEK_per_kWh: 0.31 },
  { time_start: "2026-05-24T02:15:00+02:00", SEK_per_kWh: 0.32 },
  { time_start: "2026-05-24T02:30:00+02:00", SEK_per_kWh: 0.305 },
  { time_start: "2026-05-24T02:45:00+02:00", SEK_per_kWh: 0.325 },
  { time_start: "2026-05-24T03:00:00+02:00", SEK_per_kWh: 0.29 },
  { time_start: "2026-05-24T03:15:00+02:00", SEK_per_kWh: 0.3 },
  { time_start: "2026-05-24T03:30:00+02:00", SEK_per_kWh: 0.285 },
  { time_start: "2026-05-24T03:45:00+02:00", SEK_per_kWh: 0.305 },
  { time_start: "2026-05-24T04:00:00+02:00", SEK_per_kWh: 0.28 },
  { time_start: "2026-05-24T04:15:00+02:00", SEK_per_kWh: 0.29 },
  { time_start: "2026-05-24T04:30:00+02:00", SEK_per_kWh: 0.275 },
  { time_start: "2026-05-24T04:45:00+02:00", SEK_per_kWh: 0.295 },
  { time_start: "2026-05-24T05:00:00+02:00", SEK_per_kWh: 0.3 },
  { time_start: "2026-05-24T05:15:00+02:00", SEK_per_kWh: 0.31 },
  { time_start: "2026-05-24T05:30:00+02:00", SEK_per_kWh: 0.295 },
  { time_start: "2026-05-24T05:45:00+02:00", SEK_per_kWh: 0.315 },
  { time_start: "2026-05-24T06:00:00+02:00", SEK_per_kWh: 0.41 },
  { time_start: "2026-05-24T06:15:00+02:00", SEK_per_kWh: 0.42 },
  { time_start: "2026-05-24T06:30:00+02:00", SEK_per_kWh: 0.405 },
  { time_start: "2026-05-24T06:45:00+02:00", SEK_per_kWh: 0.425 },
  { time_start: "2026-05-24T07:00:00+02:00", SEK_per_kWh: 0.55 },
  { time_start: "2026-05-24T07:15:00+02:00", SEK_per_kWh: 0.56 },
  { time_start: "2026-05-24T07:30:00+02:00", SEK_per_kWh: 0.545 },
  { time_start: "2026-05-24T07:45:00+02:00", SEK_per_kWh: 0.565 },
  { time_start: "2026-05-24T08:00:00+02:00", SEK_per_kWh: 0.47 },
  { time_start: "2026-05-24T08:15:00+02:00", SEK_per_kWh: 0.48 },
  { time_start: "2026-05-24T08:30:00+02:00", SEK_per_kWh: 0.465 },
  { time_start: "2026-05-24T08:45:00+02:00", SEK_per_kWh: 0.485 },
  { time_start: "2026-05-24T09:00:00+02:00", SEK_per_kWh: 0.22 },
  { time_start: "2026-05-24T09:15:00+02:00", SEK_per_kWh: 0.23 },
  { time_start: "2026-05-24T09:30:00+02:00", SEK_per_kWh: 0.215 },
  { time_start: "2026-05-24T09:45:00+02:00", SEK_per_kWh: 0.235 },
  { time_start: "2026-05-24T10:00:00+02:00", SEK_per_kWh: 0.05 },
  { time_start: "2026-05-24T10:15:00+02:00", SEK_per_kWh: 0.06 },
  { time_start: "2026-05-24T10:30:00+02:00", SEK_per_kWh: 0.045 },
  { time_start: "2026-05-24T10:45:00+02:00", SEK_per_kWh: 0.065 },
  { time_start: "2026-05-24T11:00:00+02:00", SEK_per_kWh: -0.08 },
  { time_start: "2026-05-24T11:15:00+02:00", SEK_per_kWh: -0.07 },
  { time_start: "2026-05-24T11:30:00+02:00", SEK_per_kWh: -0.085 },
  { time_start: "2026-05-24T11:45:00+02:00", SEK_per_kWh: -0.065 },
  { time_start: "2026-05-24T12:00:00+02:00", SEK_per_kWh: -0.15 },
  { time_start: "2026-05-24T12:15:00+02:00", SEK_per_kWh: -0.14 },
  { time_start: "2026-05-24T12:30:00+02:00", SEK_per_kWh: -0.155 },
  { time_start: "2026-05-24T12:45:00+02:00", SEK_per_kWh: -0.135 },
  { time_start: "2026-05-24T13:00:00+02:00", SEK_per_kWh: -0.12 },
  { time_start: "2026-05-24T13:15:00+02:00", SEK_per_kWh: -0.11 },
  { time_start: "2026-05-24T13:30:00+02:00", SEK_per_kWh: -0.125 },
  { time_start: "2026-05-24T13:45:00+02:00", SEK_per_kWh: -0.105 },
  { time_start: "2026-05-24T14:00:00+02:00", SEK_per_kWh: -0.04 },
  { time_start: "2026-05-24T14:15:00+02:00", SEK_per_kWh: -0.03 },
  { time_start: "2026-05-24T14:30:00+02:00", SEK_per_kWh: -0.045 },
  { time_start: "2026-05-24T14:45:00+02:00", SEK_per_kWh: -0.025 },
  { time_start: "2026-05-24T15:00:00+02:00", SEK_per_kWh: 0.09 },
  { time_start: "2026-05-24T15:15:00+02:00", SEK_per_kWh: 0.1 },
  { time_start: "2026-05-24T15:30:00+02:00", SEK_per_kWh: 0.085 },
  { time_start: "2026-05-24T15:45:00+02:00", SEK_per_kWh: 0.105 },
  { time_start: "2026-05-24T16:00:00+02:00", SEK_per_kWh: 0.38 },
  { time_start: "2026-05-24T16:15:00+02:00", SEK_per_kWh: 0.39 },
  { time_start: "2026-05-24T16:30:00+02:00", SEK_per_kWh: 0.375 },
  { time_start: "2026-05-24T16:45:00+02:00", SEK_per_kWh: 0.395 },
  { time_start: "2026-05-24T17:00:00+02:00", SEK_per_kWh: 0.84 },
  { time_start: "2026-05-24T17:15:00+02:00", SEK_per_kWh: 0.85 },
  { time_start: "2026-05-24T17:30:00+02:00", SEK_per_kWh: 0.835 },
  { time_start: "2026-05-24T17:45:00+02:00", SEK_per_kWh: 0.855 },
  { time_start: "2026-05-24T18:00:00+02:00", SEK_per_kWh: 3.65 },
  { time_start: "2026-05-24T18:15:00+02:00", SEK_per_kWh: 3.66 },
  { time_start: "2026-05-24T18:30:00+02:00", SEK_per_kWh: 3.645 },
  { time_start: "2026-05-24T18:45:00+02:00", SEK_per_kWh: 3.665 },
  { time_start: "2026-05-24T19:00:00+02:00", SEK_per_kWh: 1.12 },
  { time_start: "2026-05-24T19:15:00+02:00", SEK_per_kWh: 1.13 },
  { time_start: "2026-05-24T19:30:00+02:00", SEK_per_kWh: 1.115 },
  { time_start: "2026-05-24T19:45:00+02:00", SEK_per_kWh: 1.135 },
  { time_start: "2026-05-24T20:00:00+02:00", SEK_per_kWh: 0.74 },
  { time_start: "2026-05-24T20:15:00+02:00", SEK_per_kWh: 0.75 },
  { time_start: "2026-05-24T20:30:00+02:00", SEK_per_kWh: 0.735 },
  { time_start: "2026-05-24T20:45:00+02:00", SEK_per_kWh: 0.755 },
  { time_start: "2026-05-24T21:00:00+02:00", SEK_per_kWh: 0.58 },
  { time_start: "2026-05-24T21:15:00+02:00", SEK_per_kWh: 0.59 },
  { time_start: "2026-05-24T21:30:00+02:00", SEK_per_kWh: 0.575 },
  { time_start: "2026-05-24T21:45:00+02:00", SEK_per_kWh: 0.595 },
  { time_start: "2026-05-24T22:00:00+02:00", SEK_per_kWh: 0.49 },
  { time_start: "2026-05-24T22:15:00+02:00", SEK_per_kWh: 0.5 },
  { time_start: "2026-05-24T22:30:00+02:00", SEK_per_kWh: 0.485 },
  { time_start: "2026-05-24T22:45:00+02:00", SEK_per_kWh: 0.505 },
  { time_start: "2026-05-24T23:00:00+02:00", SEK_per_kWh: 0.41 },
  { time_start: "2026-05-24T23:15:00+02:00", SEK_per_kWh: 0.42 },
  { time_start: "2026-05-24T23:30:00+02:00", SEK_per_kWh: 0.405 },
  { time_start: "2026-05-24T23:45:00+02:00", SEK_per_kWh: 0.425 },
];

const quarters = PRICE_DAY_2026_05_24.map((row) => ({
  start: new Date(row.time_start),
  price: row.SEK_per_kWh,
}));

/** The supplier's price cap, which sits above the day's data and reaches the axis through yInclude. */
const CAP = 4;

const config = {
  price: {
    label: "Spot price",
    color: "chart-seq",
    format: { preset: "unit-price", currency: "SEK", vat: "excluded" },
  },
} as const satisfies ChartConfig;

/** The locales the demo's switch offers. The chart's own text follows the picked one. */
const LOCALES = [
  { code: "en-US", label: "English", lang: "en" },
  { code: "nb-NO", label: "Norsk", lang: "nb" },
] as const satisfies readonly { code: SupportedLocale; label: string; lang: string }[];

export function BarChartPriceSpike() {
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
          data={quarters}
          config={config}
          xKey="start"
          interval="quarter-hour"
          timeZone="Europe/Stockholm"
          yInclude={[CAP]}
          aria-label="Spot price per quarter hour with the price cap, 24 May 2026">
          <BarChart.Grid />
          <BarChart.YAxis />
          <BarChart.XAxis />
          <BarChart.Bar dataKey="price" />
          <BarChart.ReferenceLine y={CAP} label="Price cap {value}" variant="dashed" tone="error" />
          <BarChart.Tooltip />
          <BarChart.Table />
        </BarChart.Root>
      </ThemeScope>
    </LocaleProvider>
  );
}
