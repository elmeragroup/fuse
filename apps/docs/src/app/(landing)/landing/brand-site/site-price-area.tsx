"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { BarChart, formatChartValue, Sparkline } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { Field } from "@elmeragroup/fuse/field";
import { ShieldCheck } from "@elmeragroup/fuse/icons";
import { Select } from "@elmeragroup/fuse/select";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";

import { useSideOverlay } from "../window-side";
import type { SitePriceArea as SitePriceAreaConfig, SiteSection } from "./site-model";

const sitePriceArea = tv({
  slots: {
    root: "@3xl:grid-cols-5 grid items-start gap-6",
    // On a filled band in dark mode the band is the soft tint, which most dark sheets set to
    // their card colour, so the card steps down to the page there.
    card: "shadow-sm @3xl:col-span-3 landing-dark:in-data-filled:bg-background flex flex-col gap-6 rounded-xl bg-card p-6 text-card-foreground",
    result: "flex min-h-52 flex-col gap-5 border-t border-border pt-6",
    live: "flex flex-col",
    waiting: "relative flex flex-1 flex-col justify-end",
    empty: "text-sm absolute inset-x-0 top-1/3 text-center text-pretty text-muted-foreground",
    // The day's shape in muted ink, so the card shows what a pick will fill in.
    silhouette: "text-muted-foreground opacity-25 grayscale",
    figures: "landing-swap flex flex-wrap items-end gap-x-8 gap-y-3",
    average: "flex flex-col",
    figureLabel: "text-xs text-muted-foreground",
    averageValue: "text-4xl font-semibold tracking-tight font-heading tabular-nums",
    unit: "text-sm font-normal ml-1.5 text-muted-foreground",
    range: "text-sm m-0 flex gap-6",
    rangeValue: "font-semibold m-0 tabular-nums",
    chart: "flex flex-col gap-1.5",
    // The chart keeps the 6rem box the hand-drawn bars had.
    plot: "[--chart-plot-height:6rem]",
    bars: "h-24 w-full",
    note: "@3xl:col-span-2 @3xl:pt-6 flex flex-col items-start gap-3",
    noteIcon: "size-10 opacity-90",
    noteTitle: "text-lg font-semibold",
    noteText: "text-sm text-pretty opacity-85",
  },
  variants: {
    // While no area is picked, the live region fills the result so the silhouette sits at its foot.
    waiting: { true: { live: "flex-1" } },
  },
});

const styles = sitePriceArea();

/**
 * How a day's price moves across its 24 hours, from 0 at the night low to 1 at the morning
 * peak, with a second peak at dinner. Each area scales it between its own low and high, so the
 * chart's lowest and highest bars are the figures printed above it.
 */
const HOURLY_PROFILE = [
  0.32, 0.24, 0.16, 0.08, 0, 0.14, 0.52, 0.86, 1, 0.8, 0.62, 0.5, 0.42, 0.36, 0.34, 0.4, 0.58, 0.8, 0.94,
  0.88, 0.7, 0.56, 0.46, 0.38,
] as const;

/** One area's price at each hour of the section's day, from the area's low to its high. */
function hourlyPrices(area: SitePriceAreaConfig, dayStart: string) {
  const start = Date.parse(dayStart);
  return HOURLY_PROFILE.map((share, hour) => ({
    start: new Date(start + hour * 3_600_000),
    price: area.low + share * (area.high - area.low),
  }));
}

/**
 * The hourly prices as a bar chart on one scale for every area: `ceiling`, the highest price of
 * any area, reaches the value axis through `yInclude`, so a cheap area's day reads as cheap beside
 * the rest. The lowest and highest bars are the figures printed above the chart.
 */
function HourlyPrices({
  section,
  area,
  ceiling,
}: {
  section: PriceAreaSection;
  area: SitePriceAreaConfig;
  ceiling: number;
}): ReactElement {
  const config = {
    price: {
      label: section.labels.chart,
      color: "chart-seq",
      format: { preset: "unit-price", currency: section.currency, minor: true, vat: section.vat },
    },
  } as const satisfies ChartConfig;
  return (
    <BarChart.Root
      data={hourlyPrices(area, section.dayStart)}
      config={config}
      xKey="start"
      interval="hour"
      timeZone={section.timeZone}
      yInclude={[ceiling]}
      className={styles.plot()}
      aria-label={`${section.labels.chart} ${area.code}`}>
      <BarChart.XAxis />
      <BarChart.Bar dataKey="price" />
      <BarChart.Tooltip />
    </BarChart.Root>
  );
}

type PriceAreaSection = Extract<SiteSection, { _tag: "PriceArea" }>;

/** The day's figures: a price with two decimals, its unit written beside it. */
const FIGURE_FORMAT = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

/**
 * Today's price in the area the visitor picks, on a Fuse Select: the day's average, its low
 * and high, and the hourly shape. Until an area is picked the result keeps its height, so the
 * pick never moves the page under the visitor.
 */
export function SitePriceArea({
  section,
  locale,
}: {
  section: PriceAreaSection;
  locale: SupportedLocale;
}): ReactElement {
  const [code, setCode] = useState<string | null>(null);
  const [open, setOpen] = useSideOverlay(false);
  const area = section.areas.find((candidate) => candidate.code === code);
  // The figures print two decimals through the chart's own formatter, beside the section's unit.
  const price = (value: number): string => formatChartValue(value, FIGURE_FORMAT, { locale }).text;
  const ceiling = Math.max(...section.areas.map((entry) => entry.high));
  const items = Object.fromEntries(section.areas.map((entry) => [entry.code, `${entry.code} ${entry.name}`]));

  return (
    <div className={styles.root()}>
      <div className={styles.card()}>
        <Field.Root>
          <Field.Label>{section.label}</Field.Label>
          <Select.Root items={items} open={open} onOpenChange={setOpen} value={code} onValueChange={setCode}>
            <Select.Trigger>
              <Select.Value placeholder={section.placeholder} />
            </Select.Trigger>
            {/* Item alignment would misplace the popup inside the window's transformed scope. */}
            <Select.Content alignItemWithTrigger={false}>
              {section.areas.map((entry) => (
                <Select.Item key={entry.code} value={entry.code}>
                  {items[entry.code]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field.Root>
        <div className={styles.result()}>
          {/* One polite region stays mounted from the waiting state through every pick, so each
              pick changes its text and a screen reader announces the new figures. The chart sits
              outside it, and only the figures inside remount to replay their swap. */}
          <div className={styles.live({ waiting: area === undefined })} aria-live="polite">
            {area === undefined ? (
              <div className={styles.waiting()}>
                <p className={styles.empty()}>{section.labels.empty}</p>
                <span aria-hidden className={styles.silhouette()}>
                  {/* The day's shape is decoration, a server-safe Sparkline in the neutral role. */}
                  <Sparkline
                    aria-label={section.labels.chart}
                    data={hourlyPrices(section.areas[0], section.dayStart).map(({ price }) => price)}
                    locale={locale}
                    variant="bar"
                    color="chart-other"
                    className={styles.bars()}
                  />
                </span>
              </div>
            ) : (
              <div key={area.code} className={styles.figures()}>
                <p className={styles.average()}>
                  <span className={styles.figureLabel()}>{section.labels.average}</span>
                  <span className={styles.averageValue()}>
                    {price(area.average)}
                    <span className={styles.unit()}>{section.unit}</span>
                  </span>
                </p>
                <dl className={styles.range()}>
                  <div>
                    <dt className={styles.figureLabel()}>{section.labels.low}</dt>
                    <dd className={styles.rangeValue()}>{`${price(area.low)} ${section.unit}`}</dd>
                  </div>
                  <div>
                    <dt className={styles.figureLabel()}>{section.labels.high}</dt>
                    <dd className={styles.rangeValue()}>{`${price(area.high)} ${section.unit}`}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
          {area === undefined ? null : (
            <div key={`${area.code}-chart`} className={styles.chart()}>
              <HourlyPrices section={section} area={area} ceiling={ceiling} />
            </div>
          )}
        </div>
      </div>
      <div className={styles.note()}>
        <ShieldCheck aria-hidden className={styles.noteIcon()} />
        <h3 className={styles.noteTitle()}>{section.note.title}</h3>
        <p className={styles.noteText()}>{section.note.text}</p>
      </div>
    </div>
  );
}
