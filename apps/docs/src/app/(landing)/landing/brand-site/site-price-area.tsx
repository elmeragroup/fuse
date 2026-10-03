"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Field } from "@elmeragroup/fuse/field";
import { ShieldCheck } from "@elmeragroup/fuse/icons";
import { Select } from "@elmeragroup/fuse/select";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";

import type { SitePriceArea as SitePriceAreaConfig, SiteSection } from "./site-model";

const sitePriceArea = tv({
  slots: {
    root: "@3xl:grid-cols-5 grid items-start gap-6",
    // On a filled band in dark mode the band is the soft tint, which most dark sheets set to
    // their card colour, so the card steps down to the page there.
    card: "shadow-sm @3xl:col-span-3 landing-dark:in-data-filled:bg-background flex flex-col gap-6 rounded-xl bg-card p-6 text-card-foreground",
    result: "flex min-h-52 flex-col gap-5 border-t border-border pt-6",
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
    bars: "h-24 w-full text-primary",
    hours: "text-2xs grid grid-cols-4 text-muted-foreground tabular-nums",
    note: "@3xl:col-span-2 @3xl:pt-6 flex flex-col items-start gap-3",
    noteIcon: "size-10 opacity-90",
    noteTitle: "text-lg font-semibold",
    noteText: "text-sm text-pretty opacity-85",
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

const BAR_PITCH = 10;

/**
 * The hourly prices as bars in a 240 × 100 box, on one scale for every area: `ceiling`, the
 * highest price of any area, fills the box, so a cheap area's day reads as cheap beside the rest.
 */
function HourlyBars({
  area,
  ceiling,
  label,
}: {
  area: SitePriceAreaConfig;
  ceiling: number;
  /** Names the chart; a chart without one is decoration. */
  label?: string;
}): ReactElement {
  return (
    <svg
      {...(label === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
      viewBox={`0 0 ${String(HOURLY_PROFILE.length * BAR_PITCH)} 100`}
      preserveAspectRatio="none"
      className={styles.bars()}>
      {HOURLY_PROFILE.map((share, hour) => {
        const value = area.low + share * (area.high - area.low);
        const height = 4 + (value / ceiling) * 96;
        return (
          <rect
            key={hour}
            x={hour * BAR_PITCH + 1}
            y={100 - height}
            width={BAR_PITCH - 2}
            height={height}
            rx={1.5}
            fill="currentColor"
            fillOpacity={0.35 + share * 0.65}
          />
        );
      })}
    </svg>
  );
}

type PriceAreaSection = Extract<SiteSection, { _tag: "PriceArea" }>;

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
  const area = section.areas.find((candidate) => candidate.code === code);
  const price = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ceiling = Math.max(...section.areas.map((entry) => entry.high));
  const items = Object.fromEntries(section.areas.map((entry) => [entry.code, `${entry.code} ${entry.name}`]));

  return (
    <div className={styles.root()}>
      <div className={styles.card()}>
        <Field.Root>
          <Field.Label>{section.label}</Field.Label>
          <Select.Root items={items} value={code} onValueChange={setCode}>
            <Select.Trigger>
              <Select.Value placeholder={section.placeholder} />
            </Select.Trigger>
            <Select.Content>
              {section.areas.map((entry) => (
                <Select.Item key={entry.code} value={entry.code}>
                  {items[entry.code]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field.Root>
        <div className={styles.result()} aria-live="polite">
          {area === undefined ? (
            <div className={styles.waiting()}>
              <p className={styles.empty()}>{section.labels.empty}</p>
              <span aria-hidden className={styles.silhouette()}>
                <HourlyBars area={section.areas[0]} ceiling={ceiling} />
              </span>
            </div>
          ) : (
            <div key={area.code} className={styles.figures()}>
              <p className={styles.average()}>
                <span className={styles.figureLabel()}>{section.labels.average}</span>
                <span className={styles.averageValue()}>
                  {price.format(area.average)}
                  <span className={styles.unit()}>{section.unit}</span>
                </span>
              </p>
              <dl className={styles.range()}>
                <div>
                  <dt className={styles.figureLabel()}>{section.labels.low}</dt>
                  <dd className={styles.rangeValue()}>{`${price.format(area.low)} ${section.unit}`}</dd>
                </div>
                <div>
                  <dt className={styles.figureLabel()}>{section.labels.high}</dt>
                  <dd className={styles.rangeValue()}>{`${price.format(area.high)} ${section.unit}`}</dd>
                </div>
              </dl>
            </div>
          )}
          {area === undefined ? null : (
            <div key={`${area.code}-chart`} className={styles.chart()}>
              <HourlyBars area={area} ceiling={ceiling} label={`${section.labels.chart} ${area.code}`} />
              <span aria-hidden className={styles.hours()}>
                <span>00</span>
                <span>06</span>
                <span>12</span>
                <span>18</span>
              </span>
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
