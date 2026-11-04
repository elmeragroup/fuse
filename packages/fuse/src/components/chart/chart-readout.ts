"use client";

/**
 * What the tooltip, legend and headline parts print, read from Root's model. The active point is
 * Root's store state, and a template row supplies its own key, so every readout part reads the
 * same slot and key the option names.
 */
import { createContext, use } from "react";

import { assertKnownKey } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { useChartStore } from "./chart-store";
import { ownSlotLabel, qualityWords, stackTotalAt } from "./chart-text";
import type { ChartFallback, ChartFractionDigits, ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { formatValue } from "./format/value-format";
import { ownWindowSlots } from "./layout/coarse-slots";
import { keywordSlots, nowSlotOf } from "./layout/datum";
import type { Reading } from "./layout/readings";
import { seriesOf } from "./layout/series-of";
import { roundShares } from "./layout/shares";

/** The config key a template row renders for, such as one TooltipItems row. */
export const ChartRowContext = createContext<string | null>(null);

/** One side of a threshold colour, which names one of its series' two legend entries. */
export type ThresholdSideName = "below" | "above";

/** The threshold side a legend entry renders for, and the series it belongs to. */
type LegendSide = { readonly key: string; readonly side: ThresholdSideName };

/**
 * The threshold side of the legend entry around a part, null outside the legend entries of a
 * threshold series.
 */
export const ChartLegendSideContext = createContext<LegendSide | null>(null);

/**
 * The threshold side a Swatch or a SeriesLabel of one series shows: its legend entry's side, or
 * null outside a threshold series' legend entry and for a part that names another series.
 *
 * @param key - The series the part shows, or null.
 * @returns The side, or null.
 */
export function useLegendSide(key: string | null): ThresholdSideName | null {
  const entry = use(ChartLegendSideContext);
  return entry?.key === key ? entry.side : null;
}

/**
 * Whether the readout parts below follow the active point. The tooltip does, and a static legend
 * does not, so a pointer move renders no legend swatch or label.
 */
export const ChartLiveContext = createContext(false);

/**
 * The key a readout part prints: its own `dataKey`, else its template row's, else the active
 * point's nearest or focused key. An explicit `dataKey` must name a config key.
 *
 * @param part - The part's display name, which the error names.
 * @param context - The Root.
 * @param own - The part's `dataKey`.
 * @param near - The active point's key, or null under "all series".
 * @returns The key, or null when none applies.
 * @throws {ChartCompositionError} `unknown-key` for an explicit key the config lacks.
 */
export function useReadoutKey(
  part: string,
  context: ChartRootContextValue,
  own: string | undefined,
  near: string | null
): string | null {
  const row = use(ChartRowContext);
  if (own !== undefined) assertKnownKey(part, context.config, own);
  return own ?? row ?? near;
}

/** The active slot and the nearest or focused series key, each null when there is none. */
export type ActivePoint = { readonly slot: number | null; readonly key: string | null };

/**
 * The active slot inside the effective window, or null, for a part that prints no series key. It
 * never renders when the pointer moves between series inside one slot. Outside a live scope it
 * reads null and never renders on a pointer move.
 *
 * @param context - The Root.
 * @param live - Whether to follow the store, which forces it on for parts such as LegendValue.
 * @returns The slot index.
 */
export function useActiveSlot(context: ChartRootContextValue, live?: boolean): number | null {
  const scoped = use(ChartLiveContext);
  const follow = live ?? scoped;
  const active = useChartStore(context.store, (snapshot) => (follow ? snapshot.active : null));
  const window = context.model.window;
  return active !== null && window !== null && active >= window.first && active <= window.last
    ? active
    : null;
}

/**
 * The active slot inside the effective window and the nearest or focused series key, or null.
 * Outside a live scope it reads null and never renders on a pointer move. A part that prints no
 * key reads `useActiveSlot`.
 *
 * @param context - The Root.
 * @param live - Whether to follow the store, which forces it on for parts such as LegendValue.
 * @returns The slot index and the nearest or focused key.
 */
export function useActivePoint(context: ChartRootContextValue, live?: boolean): ActivePoint {
  const scoped = use(ChartLiveContext);
  const follow = live ?? scoped;
  const slot = useActiveSlot(context, follow);
  const near = useChartStore(context.store, (snapshot) => (follow ? snapshot.near : null));
  return { slot, key: near === null ? null : (context.model.series[near]?.key ?? null) };
}

/**
 * One key's reading at one slot.
 *
 * @param context - The Root.
 * @param key - A config key.
 * @param slot - A slot index.
 * @returns The reading, or undefined for an unknown key.
 */
export function readingAt(context: ChartRootContextValue, key: string, slot: number): Reading | undefined {
  return seriesOf(context.model, key)?.readings[slot];
}

/**
 * A reading as a tooltip row prints it: the value with its quality word in parentheses, or the
 * missing or pending word.
 *
 * @param context - The Root.
 * @param key - A config key.
 * @param slot - A slot index.
 * @param format - A format that replaces the series' own.
 * @returns The visual text.
 */
export function readingText(
  context: ChartRootContextValue,
  key: string,
  slot: number,
  format: ValueFormat | undefined
): string {
  const strings = CHART_STRINGS[context.locale];
  const reading = readingAt(context, key, slot);
  if (reading === undefined || reading.kind === "pending") return strings.pending;
  if (reading.kind === "missing") return strings.missing;
  const value = formatValue(
    context.locale,
    reading.value,
    format ?? context.config[key]?.format ?? {},
    "full"
  ).text;
  // A coarse series' own slot leads, then the quality word and the projection word, each on its own.
  const own = ownSlotLabel(context, key, slot);
  const series = seriesOf(context.model, key);
  const words = [
    ...(own === null ? [] : [own.text]),
    ...qualityWords(context.locale, reading.quality, series !== undefined && slot >= series.projectedFrom),
  ];
  return words.length === 0 ? value : `${value} (${words.join(", ")})`;
}

/**
 * A share as a percentage at the format's digits, or the dictionary dash.
 *
 * @param context - The Root.
 * @param share - The share in percent, or null for a zero denominator.
 * @param format - The share's digits.
 * @returns The visual text.
 */
export function shareText(
  context: ChartRootContextValue,
  share: number | null,
  format: ChartFractionDigits | undefined
): string {
  if (share === null) return "–";
  const digits = format?.maximumFractionDigits ?? format?.minimumFractionDigits ?? 0;
  return formatValue(
    context.locale,
    share / 100,
    {
      style: "percent",
      minimumFractionDigits: format?.minimumFractionDigits ?? 0,
      maximumFractionDigits: digits,
    },
    "full"
  ).text;
}

/**
 * The share digits of a format, which decide how a share set rounds together.
 *
 * @param format - The share's digits.
 * @returns The fraction digits of the printed percentage.
 */
export function shareDigits(format: ChartFractionDigits | undefined): number {
  return format?.maximumFractionDigits ?? format?.minimumFractionDigits ?? 0;
}

/**
 * Each key's share of the sum of the absolute readings of every key at one slot, rounded together.
 *
 * @param context - The Root.
 * @param slot - A slot index.
 * @param digits - The fraction digits.
 * @returns Each key's share in percent, or null for a zero denominator.
 */
export function slotShares(
  context: ChartRootContextValue,
  slot: number,
  digits: number
): Map<string, number | null> {
  const { series } = context.model;
  const parts = series.map(({ readings }) => {
    const reading = readings[slot];
    return reading?.kind === "reading" ? reading.value : null;
  });
  const shares = roundShares(parts, digits);
  return new Map(series.map(({ key }, index) => [key, shares[index] ?? null]));
}

/**
 * Each key's share of the sum of every key's absolute total over the effective window.
 *
 * @param context - The Root.
 * @param digits - The fraction digits.
 * @returns Each key's share in percent, or null for a zero denominator.
 */
export function windowShares(context: ChartRootContextValue, digits: number): Map<string, number | null> {
  const { series, window } = context.model;
  const totals = series.map((entry) => {
    if (window === null) return 0;
    let total = 0;
    // A coarse reading counts once, though every Root slot of its slot holds it.
    for (const slot of ownWindowSlots(entry, window)) {
      const reading = entry.readings[slot];
      if (reading?.kind === "reading") total += reading.value;
    }
    return total;
  });
  const shares = roundShares(totals, digits);
  return new Map(series.map(({ key }, index) => [key, shares[index] ?? null]));
}

/**
 * One stack's net total at a slot, the sum of its present parts.
 *
 * @param context - The Root.
 * @param stack - A stack id that holds two or more keys.
 * @param slot - A slot index.
 * @returns The total and whether a part is missing, or null when no part has a reading.
 */
export function stackTotal(
  context: ChartRootContextValue,
  stack: string,
  slot: number
): { readonly total: number; readonly incomplete: boolean } | null {
  return stackTotalAt(context.model, context.model.stacks.find(({ id }) => id === stack)?.keys ?? [], slot);
}

/**
 * The slot a fallback keyword selects for one key over the effective window: its first or last
 * reading, its lowest or highest, or the slot that holds `now` while the window shows it.
 *
 * @param context - The Root.
 * @param key - A config key.
 * @param fallback - The keyword.
 * @returns The slot, or null when the keyword selects nothing.
 */
export function fallbackSlot(
  context: ChartRootContextValue,
  key: string,
  fallback: ChartFallback
): number | null {
  const { model } = context;
  const { window } = model;
  if (window === null) return null;
  const readings = seriesOf(model, key)?.readings ?? [];
  const values = readings.map((reading) => (reading.kind === "reading" ? reading.value : null));
  // A tie picks its first slot, as `keywordSlots` lists the tied slots in x order.
  const [slot] = keywordSlots(fallback, { values, window, nowSlot: nowSlotOf(model.domain, context.now) });
  return slot ?? null;
}
