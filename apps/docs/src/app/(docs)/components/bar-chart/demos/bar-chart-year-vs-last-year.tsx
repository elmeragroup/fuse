"use client";

import { useState } from "react";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig, ChartQuality } from "@elmeragroup/fuse/chart";
import { LocaleProvider, ThemeScope, useTheme } from "@elmeragroup/fuse/theme";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

// NO1 household consumption per metering point and month, November 2024 to 16 October 2026, computed from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_HOUSEHOLD_MONTHLY = [
  { month: "2024-11", kwh: 1425.25 },
  { month: "2024-12", kwh: 1646.62 },
  { month: "2025-01", kwh: 1837.12 },
  { month: "2025-02", kwh: 1603.55 },
  { month: "2025-03", kwh: 1398.42 },
  { month: "2025-04", kwh: 1004.97 },
  { month: "2025-05", kwh: 863.99 },
  { month: "2025-06", kwh: 715.08 },
  { month: "2025-07", kwh: 592.65 },
  { month: "2025-08", kwh: 683.19 },
  { month: "2025-09", kwh: 781.47 },
  { month: "2025-10", kwh: 1125.71 },
  { month: "2025-11", kwh: 1413.92 },
  { month: "2025-12", kwh: 1582.73 },
  { month: "2026-01", kwh: 2091.35 },
  { month: "2026-02", kwh: 1892.3 },
  { month: "2026-03", kwh: 1480.73 },
  { month: "2026-04", kwh: 1128.18 },
  { month: "2026-05", kwh: 927.42 },
  { month: "2026-06", kwh: 716.2 },
  { month: "2026-07", kwh: 622.97 },
  { month: "2026-08", kwh: 701.11 },
  { month: "2026-09", kwh: 801.92 },
  { month: "2026-10", kwh: 552.63 },
];

/** The first instant of an Oslo month, which starts in winter time from November to March. */
function osloMonth(month: string): Date {
  const number = Number(month.slice(5));
  return new Date(`${month}-01T00:00:00${number >= 4 && number <= 10 ? "+02:00" : "+01:00"}`);
}

const thisYear = NO1_HOUSEHOLD_MONTHLY.slice(12);
const lastYear = NO1_HOUSEHOLD_MONTHLY.slice(0, 12);

/** October 2026 runs to the 16th, so the reading is a partial month and counts as estimated. */
function qualityOf(index: number): ChartQuality {
  return index === 11 ? "estimated" : "measured";
}

const months = thisYear.map((row, index) => ({
  month: osloMonth(row.month),
  thisYear: row.kwh,
  lastYear: lastYear[index]?.kwh ?? null,
  quality: qualityOf(index),
}));

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const config = {
  thisYear: { label: "This year", color: "chart-1", qualityKey: "quality", format: energy },
  lastYear: { label: "Last year", color: "chart-2", format: energy, variant: "hatched" },
} as const satisfies ChartConfig;

/** The locales the demo's switch offers. The chart's own text follows the picked one. */
const LOCALES = [
  { code: "en-US", label: "English", lang: "en" },
  { code: "nb-NO", label: "Norsk", lang: "nb" },
] as const satisfies readonly { code: SupportedLocale; label: string; lang: string }[];

export function BarChartYearVsLastYear() {
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
          data={months}
          config={config}
          xKey="month"
          interval="month"
          timeZone="Europe/Oslo"
          aria-label="Household consumption per month, the last 12 months against the 12 before">
          <BarChart.Grid />
          <BarChart.YAxis />
          <BarChart.XAxis />
          <BarChart.BarGroup series={["thisYear", "lastYear"]}>
            <BarChart.Bar dataKey="thisYear" />
            <BarChart.Bar dataKey="lastYear" />
          </BarChart.BarGroup>
          <BarChart.Tooltip />
          <BarChart.Legend />
          <BarChart.Table />
        </BarChart.Root>
      </ThemeScope>
    </LocaleProvider>
  );
}
