import type { ReactElement } from "react";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

import { useCopy } from "../copy/copy";
import { numberFormat } from "../copy/intl";
import { FrameChart } from "../primitives/frame-chart";
import { CURRENT_DAYS, WEEK_KWH } from "./customer-data";

/** Monday 12 October 2026, the first day of the charted week, read in UTC so every render agrees. */
const WEEK_START_UTC = Date.UTC(2026, 9, 12);
const DAY_MS = 86_400_000;

/** One row per day of the week, built once so every frame hands the chart the same data. */
const DAYS = WEEK_KWH.map((kwh, index) => ({ day: new Date(WEEK_START_UTC + index * DAY_MS), kwh }));

/**
 * Noon on the first of the week's current days. The chart fades every day that ended before it, so
 * the earlier days dim and the current days keep their full paint.
 */
const NOW = new Date(WEEK_START_UTC + (WEEK_KWH.length - CURRENT_DAYS + 0.5) * DAY_MS);

/**
 * The brand's primary role as the series' paint, through Fuse's consumer override. Fuse's chart roles
 * are the same for every brand and follow only the scheme, and these bars wear the brand, as a
 * brand flip around them must show. `bg-primary` reads the same variable, since Fuse declares its
 * colours inline.
 */
const BRAND_PAINT = { "--chart-color-kwh": "var(--primary)" } as const;

/** Each weekday's short name in the video's locale, such as "Mon", under its bar. */
const WEEKDAY_FORMAT = { weekday: "short" } as const;

/**
 * The week's total use in whole kWh, formatted for the video's locale.
 *
 * @param locale - The video's locale.
 * @returns The formatted total.
 */
export function weekTotal(locale: string): string {
  const total = WEEK_KWH.reduce((sum, day) => sum + day, 0);
  return numberFormat(locale, { maximumFractionDigits: 0 }).format(total);
}

/** Props for {@link WeekBars}. */
export type WeekBarsProps = {
  /** Names each day under its bar in the video's locale. */
  readonly weekdays?: boolean;
};

/**
 * A week of use as a Fuse bar chart, one bar per day on a UTC day axis in the brand's primary role,
 * with the current days marked: the chart's `now` falls on the first of them, and the days before it
 * fade. The config names the first chart role, which keeps the series typed, and `BRAND_PAINT`
 * overrides it with the brand's primary, because Fuse's chart roles do not change with the brand.
 * It fills the height its flex container leaves it, which it never grows, and draws at rest on
 * every frame (see {@link FrameChart}).
 *
 * @returns The chart.
 */
export function WeekBars({ weekdays = false }: WeekBarsProps): ReactElement {
  const { usage } = useCopy().brandMorph;
  const config = {
    kwh: {
      label: usage,
      color: "chart-1",
      format: { preset: "energy", unit: "kWh", maximumFractionDigits: 1 },
    },
  } as const satisfies ChartConfig;
  return (
    // The chart sits out of flow, so its plot never sizes the box: the box takes what the card leaves.
    <div className="relative min-h-0 flex-1">
      <FrameChart
        className="absolute inset-0"
        data={DAYS}
        config={config}
        xKey="day"
        interval="day"
        timeZone="UTC"
        now={NOW}
        data-fade="past"
        style={BRAND_PAINT}
        aria-label={usage}>
        {weekdays ? <BarChart.XAxis format={WEEKDAY_FORMAT} /> : null}
        <BarChart.Bar dataKey="kwh" />
      </FrameChart>
    </div>
  );
}
