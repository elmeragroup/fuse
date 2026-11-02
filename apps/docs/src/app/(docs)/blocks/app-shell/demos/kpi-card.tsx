/**
 * One key figure on the overview: a label, the value in its unit, how it changed and a Sparkline
 * of how it got there. It renders on the server: `formatChartValue` writes the value as the charts
 * write theirs, and `Sparkline` needs no hooks.
 */

import type { ReactElement, ReactNode } from "react";

import { Card } from "@elmeragroup/fuse/card";
import { formatChartValue, Sparkline } from "@elmeragroup/fuse/chart";
import type { ValueFormat } from "@elmeragroup/fuse/chart";
import { TrendDown, TrendUp } from "@elmeragroup/fuse/icons";

import { APP_LOCALE } from "./app-config";

const CHANGE_FORMAT = {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
} as const satisfies ValueFormat;

export type KpiCardProps = {
  /** What the figure is, such as "Consumption, March 1–28". */
  label: string;
  value: number;
  /** The value's unit, as the charts take it, which names the value for screen readers. */
  format: ValueFormat;
  /**
   * A shorter visible figure: the number in `format` and a `unit` after it, for a unit whose full
   * label is long, such as a price whose VAT basis the card's label already states.
   */
  figure?: { readonly format: ValueFormat; readonly unit: string };
  /** A badge at the card's end, such as the price level. */
  badge?: ReactNode;
  /** The change as a fraction, such as -0.031, and what it compares with. */
  change?: { readonly value: number; readonly against: string };
  /** A line under the value for a figure with no change to show, such as how it was estimated. */
  note?: string;
  /** The values behind the figure, oldest first; `null` is a gap. */
  trend: readonly (number | null)[];
  /** The Sparkline's accessible name. */
  trendLabel: string;
  /** How the Sparkline draws: a line by default, bars for daily totals. */
  trendVariant?: "line" | "bar" | "area";
};

/** One key figure. */
export function KpiCard({
  label,
  value,
  format,
  figure,
  badge,
  change,
  note,
  trend,
  trendLabel,
  trendVariant = "line",
}: KpiCardProps): ReactElement {
  const spoken = formatChartValue(value, format, { locale: APP_LOCALE }).spoken;
  const text =
    figure === undefined
      ? formatChartValue(value, format, { locale: APP_LOCALE }).text
      : `${formatChartValue(value, figure.format, { locale: APP_LOCALE }).text}\u00a0${figure.unit}`;
  const changed =
    change === undefined ? undefined : formatChartValue(change.value, CHANGE_FORMAT, { locale: APP_LOCALE });
  const Trend = change !== undefined && change.value < 0 ? TrendDown : TrendUp;
  return (
    <Card.Root>
      <Card.Header>
        <Card.Description>{label}</Card.Description>
        {badge === undefined ? null : <Card.Action>{badge}</Card.Action>}
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold leading-tight tracking-tight tabular-nums">
            <span aria-hidden>{text}</span>
            <span className="sr-only">{spoken}</span>
          </p>
          {change === undefined || changed === undefined ? null : (
            <p className="text-xs flex items-center gap-1 text-muted-foreground tabular-nums">
              <Trend aria-hidden className="size-3.5" />
              <span aria-hidden>{changed.text}</span>
              <span className="sr-only">{changed.spoken}</span> {change.against}
            </p>
          )}
          {note === undefined ? null : <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
        <Sparkline
          aria-label={trendLabel}
          data={trend}
          format={format}
          locale={APP_LOCALE}
          variant={trendVariant}
          emphasis="last"
          className="h-10 w-full"
        />
      </Card.Content>
    </Card.Root>
  );
}
