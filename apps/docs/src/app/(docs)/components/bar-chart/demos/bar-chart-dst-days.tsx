"use client";

import { useState } from "react";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { LocaleProvider, ThemeScope, useTheme } from "@elmeragroup/fuse/theme";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

// NO1 household and cabin consumption per hour on the fall-back day 26 October 2025, computed from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_FALL_BACK_2025_10_26 = [
  {
    startTime: "2025-10-26T00:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1571242.2,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T00:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 75032.87,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T01:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1492842.2,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T01:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 73333.44,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T02:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1434677.0,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T02:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 72537.99,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T02:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1394542.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T02:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 72161.19,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T03:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1375271.0,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T03:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 71937.85,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T04:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1372822.2,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T04:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 72100.06,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T05:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1384732.6,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T05:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 72824.516,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T06:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1424383.4,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T06:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 74122.11,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T07:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1513880.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T07:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 76857.75,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T08:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1658430.0,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T08:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 80452.875,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T09:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1789900.8,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T09:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 82339.52,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T10:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1843404.6,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T10:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 81747.22,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T11:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1844321.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T11:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 78534.47,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T12:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1838413.9,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T12:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 75068.4,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T13:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1829916.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T13:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 72105.305,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T14:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1854605.4,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T14:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 69913.49,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T15:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1912368.2,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T15:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 68465.85,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T16:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2005894.6,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T16:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 67592.49,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T17:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2102769.0,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T17:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 68358.9,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T18:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2123271.8,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T18:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 67678.27,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T19:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2108637.8,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T19:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 67089.26,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T20:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2082325.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T20:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 66566.16,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T21:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2014850.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T21:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 66278.93,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T22:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1910449.0,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T22:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 66289.18,
    meteringPointCount: 110794,
  },
  {
    startTime: "2025-10-26T23:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1777729.5,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T23:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 66160.125,
    meteringPointCount: 110794,
  },
];

// NO1 household and cabin consumption per hour on the spring-forward day 29 March 2026, computed from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_SPRING_2026_03_29 = [
  {
    startTime: "2026-03-29T00:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1974532.9,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T00:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 161631.34,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T01:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1922605.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T01:00:00+01:00",
    consumptionGroup: "cabin",
    quantityKwh: 158930.25,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T03:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1902129.6,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T03:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 159458.17,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T04:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1885827.5,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T04:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 160378.02,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T05:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1886613.8,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T05:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 162337.06,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T06:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1905999.1,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T06:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 165044.62,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T07:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1940179.9,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T07:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 170032.83,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T08:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2002439.6,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T08:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 175748.67,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T09:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2073275.2,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T09:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 178734.2,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T10:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2100190.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T10:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 174760.61,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T11:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2072195.8,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T11:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 165014.94,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T12:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2012351.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T12:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 153267.08,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T13:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1970783.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T13:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 147840.45,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T14:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1939109.8,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T14:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 150897.88,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T15:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1966314.6,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T15:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 158627.28,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T16:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2053701.1,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T16:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 171315.2,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T17:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2132245.5,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T17:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 181538.05,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T18:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2195977.5,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T18:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 186469.64,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T19:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2247678.2,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T19:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 184660.98,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T20:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2281528.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T20:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 179909.38,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T21:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2269646.2,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T21:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 174764.03,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T22:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2219442.8,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T22:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 170490.0,
    meteringPointCount: 110981,
  },
  {
    startTime: "2026-03-29T23:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2127512.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T23:00:00+02:00",
    consumptionGroup: "cabin",
    quantityKwh: 166462.66,
    meteringPointCount: 110981,
  },
];

type Row = (typeof NO1_FALL_BACK_2025_10_26)[number];

/** One row per hour with each group's consumption per metering point. */
function perMeter(rows: readonly Row[]) {
  const hours = new Map<string, { start: Date; household: number; cabin: number }>();
  for (const row of rows) {
    const hour = hours.get(row.startTime) ?? { start: new Date(row.startTime), household: 0, cabin: 0 };
    hour[row.consumptionGroup === "household" ? "household" : "cabin"] =
      row.quantityKwh / row.meteringPointCount;
    hours.set(row.startTime, hour);
  }
  return [...hours.values()];
}

const DAYS = {
  "fall-back": { rows: perMeter(NO1_FALL_BACK_2025_10_26), name: "26 October 2025, 25 hours" },
  spring: { rows: perMeter(NO1_SPRING_2026_03_29), name: "29 March 2026, 23 hours" },
} as const;

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 2 } as const;

const config = {
  household: { label: "Household", color: "chart-1", format: energy },
  cabin: { label: "Cabin", color: "chart-2", format: energy },
} as const satisfies ChartConfig;

/** The locales the demo's switch offers. The chart's own text follows the picked one. */
const LOCALES = [
  { code: "en-US", label: "English", lang: "en" },
  { code: "nb-NO", label: "Norsk", lang: "nb" },
] as const satisfies readonly { code: SupportedLocale; label: string; lang: string }[];

export function BarChartDstDays() {
  const [locale, setLocale] = useState<SupportedLocale>("en-US");
  const theme = useTheme();
  const [day, setDay] = useState<keyof typeof DAYS>("fall-back");
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
        <ToggleGroup.Root
          aria-label="Day"
          value={[day]}
          onValueChange={(value: string[]) => {
            const next = value[0];
            if (next === "fall-back" || next === "spring") setDay(next);
          }}>
          <ToggleGroup.Item value="fall-back">26 October 2025</ToggleGroup.Item>
          <ToggleGroup.Item value="spring">29 March 2026</ToggleGroup.Item>
        </ToggleGroup.Root>
        <BarChart.Root
          data={DAYS[day].rows}
          config={config}
          xKey="start"
          interval="hour"
          timeZone="Europe/Oslo"
          aria-label={`Consumption per metering point, ${DAYS[day].name}`}>
          <BarChart.Grid />
          <BarChart.YAxis />
          <BarChart.XAxis />
          <BarChart.BarGroup series={["household", "cabin"]}>
            <BarChart.Bar dataKey="household" />
            <BarChart.Bar dataKey="cabin" />
          </BarChart.BarGroup>
          <BarChart.Tooltip />
          <BarChart.Legend />
          <BarChart.Table />
        </BarChart.Root>
      </ThemeScope>
    </LocaleProvider>
  );
}
