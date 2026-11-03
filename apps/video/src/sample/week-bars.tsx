import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { useVideoLocale } from "../copy/copy";
import { dateTimeFormat, numberFormat } from "../copy/intl";
import { CURRENT_DAYS, WEEK_KWH } from "./customer-data";

/** Monday 12 October 2026, the first day of the charted week, read in UTC so every render agrees. */
const WEEK_START_UTC = Date.UTC(2026, 9, 12);
const DAY_MS = 86_400_000;

/** The week's tallest day, which a full-height bar draws. */
const MAX_KWH = Math.max(...WEEK_KWH);

/** The chart's parts; a current day's bar takes the primary role, the rest a tint of it. */
const weekBars = tv({
  slots: {
    root: "flex min-h-0 flex-1 items-end",
    day: "flex h-full min-w-0 flex-1 flex-col justify-end gap-2",
    bar: "rounded-t-sm",
    weekday: "text-xs text-center font-mono text-muted-foreground",
  },
  variants: {
    current: {
      true: { bar: "bg-primary" },
      false: { bar: "bg-primary/30" },
    },
  },
});

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
  /** Spaces the bars. */
  readonly className?: string;
};

/**
 * A week of use as one bar per day, scaled to the week's tallest day, with the current days marked.
 *
 * @returns The chart, filling the height its container leaves it.
 */
export function WeekBars({ weekdays = false, className }: WeekBarsProps): ReactElement {
  const locale = useVideoLocale();
  const slots = weekBars();
  const weekday = dateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return (
    <div className={slots.root({ className })}>
      {WEEK_KWH.map((value, index) => (
        <div key={index} className={slots.day()}>
          <div
            className={slots.bar({ current: index >= WEEK_KWH.length - CURRENT_DAYS })}
            style={{ height: `${String((value / MAX_KWH) * 100)}%` }}
          />
          {weekdays ? (
            <span className={slots.weekday()}>
              {weekday.format(new Date(WEEK_START_UTC + index * DAY_MS))}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
