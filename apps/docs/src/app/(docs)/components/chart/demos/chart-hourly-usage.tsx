"use client";

import { useState } from "react";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { LocaleProvider, ThemeScope, useTheme } from "@elmeragroup/fuse/theme";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

// Invented values. Twelve hours of one household's usage in kWh from midnight in Oslo on
// 17 October 2026, which is UTC+2.
const hours = [0.42, 0.38, 0.35, 0.34, 0.36, 0.51, 0.88, 1.24, 1.02, 0.74, 0.66, 0.61].map((kwh, index) => ({
  start: new Date(Date.UTC(2026, 9, 16, 22 + index)),
  kwh,
}));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

/** The locales the demo's switch offers. The chart's own text follows the picked one. */
const LOCALES = [
  { code: "en-US", label: "English", lang: "en" },
  { code: "nb-NO", label: "Norsk", lang: "nb" },
] as const satisfies readonly { code: SupportedLocale; label: string; lang: string }[];

export function ChartHourlyUsage() {
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
          aria-label="Usage per hour, 17 October">
          <Chart.Headline>
            <Chart.ActiveValue dataKey="kwh" fallback="max" />
            <span>Usage per hour, 17 October</span>
          </Chart.Headline>
          <Chart.Grid />
          <Chart.YAxis />
          <Chart.XAxis />
          <Chart.Bar dataKey="kwh" />
          <Chart.ReferenceLine y={0.8} label="Target {value}" variant="dashed" />
          <Chart.Legend />
          <Chart.Tooltip />
          <Chart.Table />
        </Chart.Root>
      </ThemeScope>
    </LocaleProvider>
  );
}
