"use client";

import { useId, useState } from "react";

import { BarChart, formatChartSlot, formatChartValue, useChartPoint } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { LocaleProvider, ThemeScope, useLocale, useTheme } from "@elmeragroup/fuse/theme";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

// NO1 household consumption per metering point and day in October 2025, with each day's highest hour, computed from the Elhub dataset
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

/** Oslo midnight of a calendar date, in summer time up to the last Sunday of October. */
function osloMidnight(date: string, summerUntil: string): Date {
  return new Date(`${date}T00:00:00${date <= summerUntil ? "+02:00" : "+01:00"}`);
}

const days = NO1_HOUSEHOLD_DAILY_2025_10.map((row) => ({
  day: osloMidnight(row.date, "2025-10-26"),
  peak: row.peakKwh,
  peakStart: new Date(row.peakStart),
}));

/** The three highest daily peaks, which the grid company averages for the capacity step. */
const TOP_THREE = [...days].sort((a, b) => b.peak - a.peak).slice(0, 3);
const AVERAGE = TOP_THREE.reduce((sum, day) => sum + day.peak, 0) / TOP_THREE.length;

/** The capacity step's limits in kW. They come from the grid company's tariff, not from the data. */
const STEP_FLOOR = 2;
const STEP_LIMIT = 5;

const ZONE = "Europe/Oslo";

/** Each day's peak hour by the day's start, so the tooltip finds the active day's hour. */
const PEAK_START = new Map(days.map((day) => [day.day.getTime(), day.peakStart]));

const config = {
  peak: {
    label: "Highest hour",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

/**
 * The Figma Effekt card's words in the two locales the switch offers. The nb-NO strings are the
 * card's own, from frame 5504:20089.
 */
const COPY = {
  "en-US": {
    caption: "Average of the hours with the highest use",
    limit: "Desired capacity limit {value}",
    counts: "counts toward the capacity step",
  },
  "nb-NO": {
    caption: "Snitt av timene med høyest strømbruk",
    limit: "Ønsket effektgrense {value}",
    counts: "teller i effekttrinnet",
  },
} as const;

/** The card's words for `locale`, in English for any locale the switch does not offer. */
function copyFor(locale: SupportedLocale) {
  return locale === "nb-NO" ? COPY["nb-NO"] : COPY["en-US"];
}

/** The card's headline, the average of the three peak days over its caption. */
function StepHeadline() {
  const { locale } = useLocale();
  return (
    <BarChart.Headline>
      <span>{formatChartValue(AVERAGE, config.peak.format, { locale }).text}</span>
      <span>{copyFor(locale).caption}</span>
    </BarChart.Headline>
  );
}

/** The active day's peak hour, read from the chart's active point. */
function PeakHour() {
  const point = useChartPoint();
  const { locale } = useLocale();
  const start = point?.x instanceof Date ? PEAK_START.get(point.x.getTime()) : undefined;
  if (start === undefined) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Peak {formatChartSlot(start, "hour", { locale, timeZone: ZONE }).text}
    </p>
  );
}

/** The three days that set the step, each with the hour of its peak. */
function PeakHours() {
  const { locale } = useLocale();
  const heading = useId();
  return (
    <div className="text-sm flex flex-col gap-1">
      <p id={heading} className="font-medium">
        Hours that set the step
      </p>
      <ol aria-labelledby={heading} className="flex flex-col gap-1 text-muted-foreground tabular-nums">
        {TOP_THREE.map((day) => (
          <li key={day.day.getTime()}>
            {formatChartSlot(day.day, "day", { locale, timeZone: ZONE }).text},{" "}
            {formatChartSlot(day.peakStart, "hour", { locale, timeZone: ZONE }).text}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The locales the demo's switch offers. The chart's own text follows the picked one. */
const LOCALES = [
  { code: "en-US", label: "English", lang: "en" },
  { code: "nb-NO", label: "Norsk", lang: "nb" },
] as const satisfies readonly { code: SupportedLocale; label: string; lang: string }[];

export function BarChartCapacityStep() {
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
          timeZone={ZONE}
          yInclude={[STEP_LIMIT]}
          aria-label="Highest hour per day, October 2025">
          <StepHeadline />
          <BarChart.Grid />
          <BarChart.YAxis />
          <BarChart.XAxis />
          <BarChart.ReferenceArea
            y1={STEP_FLOOR}
            y2={STEP_LIMIT}
            label={`Capacity step ${String(STEP_FLOOR)}–${String(STEP_LIMIT)} kW`}
            tone="muted"
          />
          <BarChart.Bar
            dataKey="peak"
            emphasis={{ x: TOP_THREE.map((day) => day.day) }}
            emphasisLabel={copyFor(locale).counts}
          />
          <BarChart.ReferenceLine y={AVERAGE} label="Average of the top three {value}" variant="dashed" />
          <BarChart.ReferenceLine y={STEP_LIMIT} label={copyFor(locale).limit} tone="error" />
          <BarChart.Tooltip>
            <BarChart.TooltipLabel />
            <BarChart.TooltipItems>
              <BarChart.Swatch />
              <BarChart.SeriesLabel />
              <BarChart.TooltipValue />
            </BarChart.TooltipItems>
            <PeakHour />
          </BarChart.Tooltip>
          <BarChart.Table>
            <BarChart.TableColumn dataKey="peakStart" header="Peak hour" format="hour-range" />
          </BarChart.Table>
        </BarChart.Root>
        <PeakHours />
      </ThemeScope>
    </LocaleProvider>
  );
}
