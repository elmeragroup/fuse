"use client";

import { useState } from "react";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { LocaleProvider, ThemeScope, useTheme } from "@elmeragroup/fuse/theme";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

import { HOURLY_YEAR_KWH, HOURLY_YEAR_START } from "./data/hourly-year";

const start = Date.parse(HOURLY_YEAR_START);
const hours = HOURLY_YEAR_KWH.map((kwh, index) => ({ start: new Date(start + index * 3_600_000), kwh }));

const config = {
  kwh: {
    label: "Household",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

/** The locales the demo's switch offers. The chart's own text follows the picked one. */
const LOCALES = [
  { code: "en-US", label: "English", lang: "en" },
  { code: "nb-NO", label: "Norsk", lang: "nb" },
] as const satisfies readonly { code: SupportedLocale; label: string; lang: string }[];

/** A year of hours draws as one path per series, and the table pages it by ISO week. */
export function ChartTablePages() {
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
        <Chart.Root
          data={hours}
          config={config}
          xKey="start"
          interval="hour"
          timeZone="Europe/Oslo"
          aria-label="Household usage per hour, October 2025 to September 2026">
          <Chart.YAxis />
          <Chart.XAxis />
          <Chart.Bar dataKey="kwh" />
          <Chart.Tooltip />
          <Chart.Table />
        </Chart.Root>
      </ThemeScope>
    </LocaleProvider>
  );
}
