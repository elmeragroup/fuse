"use client";

/**
 * What a series model reads out: the active slot and series, a reading as a tooltip row or a legend
 * value prints it, the shares, the stack totals, a fallback keyword's slot, and the rows of the
 * table. A cartesian Root's readout reads it, and so does any family that builds a
 * `CartesianModel`. It reads no plot geometry.
 */
import { use } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import type { ChartTableCell, ChartTableModel, ChartTablePage, ChartTableRow } from "./chart-readout-port";
import { ChartLiveContext } from "./chart-scope-contexts";
import { useChartStore } from "./chart-store";
import type { ChartStore } from "./chart-store";
import { PAGE_ROWS } from "./chart-table-shell";
import { ownSlotLabel, qualityWords, slotLabel, stackTotalAt } from "./chart-text";
import type { TextContext } from "./chart-text";
import type { ChartFallback, ChartRow, ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { seriesLabel } from "./format/series-label";
import { formatSlot, slotStart } from "./format/time-format";
import type { Interval, TimePreset } from "./format/time-format";
import { formatUnitLabel, formatUnitless, formatValue } from "./format/value-format";
import type { CartesianModel } from "./layout/cartesian-model";
import { ownWindowSlots, rowSpans } from "./layout/coarse-slots";
import { keywordSlots, nowSlotOf } from "./layout/datum";
import type { Reading } from "./layout/readings";
import { seriesOf } from "./layout/series-of";
import { roundShares } from "./layout/shares";

/** What the active-point hooks read: the model's window and series, and the store. */
type SeriesActive = { readonly model: CartesianModel; readonly store: ChartStore };

/**
 * The active slot inside the effective window, or null, for a part that prints no series key. It
 * never renders when the pointer moves between series inside one slot. Outside a live scope it
 * reads null and never renders on a pointer move.
 *
 * @param context - The Root.
 * @param live - Whether to follow the store, which forces it on for parts such as LegendValue.
 * @returns The slot index.
 */
export function useActiveSlot(context: SeriesActive, live?: boolean): number | null {
  const scoped = use(ChartLiveContext);
  const follow = live ?? scoped;
  const active = useChartStore(context.store, (snapshot) => (follow ? snapshot.active : null));
  const window = context.model.window;
  return active !== null && window !== null && active >= window.first && active <= window.last
    ? active
    : null;
}

/**
 * One key's reading at one slot.
 *
 * @param context - The Root.
 * @param key - A config key.
 * @param slot - A slot index.
 * @returns The reading, or undefined for an unknown key.
 */
export function readingAt(
  context: Pick<TextContext, "model">,
  key: string,
  slot: number
): Reading | undefined {
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
  context: TextContext,
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
 * Each key's share of the sum of the absolute readings of every key at one slot, rounded together.
 *
 * @param context - The Root.
 * @param slot - A slot index.
 * @param digits - The fraction digits.
 * @returns Each key's share in percent, or null for a zero denominator.
 */
export function slotShares(context: TextContext, slot: number, digits: number): Map<string, number | null> {
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
export function windowShares(context: TextContext, digits: number): Map<string, number | null> {
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
  context: TextContext,
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
export function fallbackSlot(context: TextContext, key: string, fallback: ChartFallback): number | null {
  const { model } = context;
  const { window } = model;
  if (window === null) return null;
  const readings = seriesOf(model, key)?.readings ?? [];
  const values = readings.map((reading) => (reading.kind === "reading" ? reading.value : null));
  // A tie picks its first slot, as `keywordSlots` lists the tied slots in x order.
  const [slot] = keywordSlots(fallback, { values, window, nowSlot: nowSlotOf(model.domain, context.now) });
  return slot ?? null;
}

/** The calendar period one page holds at each interval, the coarsest whose largest instance fits. */
const PAGE_PERIOD = {
  second: "minute",
  minute: "hour",
  "quarter-hour": "day",
  hour: "week",
  day: "year",
  week: "year",
  month: "year",
  year: "year",
} as const satisfies { readonly [I in Interval]: Interval };

/** The label each page period prints in the status, such as `uke 2`. */
const PAGE_LABEL = {
  minute: "time",
  hour: "hour",
  day: "date",
  week: "week",
  year: "year",
} as const satisfies { readonly [I in (typeof PAGE_PERIOD)[Interval]]: TimePreset };

/** The slots the table lists: every slot that holds a reading or a missing reading in some series. */
function tableSlots(model: CartesianModel): number[] {
  const { series, domain } = model;
  const count = domain.kind === "time" ? domain.starts.length : domain.names.length;
  const slots: number[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    if (series.some(({ readings }) => readings[slot]?.kind !== "pending")) slots.push(slot);
  }
  return slots;
}

/** The table's pages: one for 500 rows or fewer, else one per calendar period or per 500 categories. */
function tablePages(
  model: CartesianModel,
  locale: SupportedLocale,
  slots: readonly number[]
): ChartTablePage[] {
  const { domain } = model;
  const strings = CHART_STRINGS[locale];
  if (slots.length <= PAGE_ROWS) return [{ key: 0, slots, label: "", spoken: "" }];
  if (domain.kind === "category") {
    const pages: ChartTablePage[] = [];
    for (let from = 0; from < slots.length; from += PAGE_ROWS) {
      const page = slots.slice(from, from + PAGE_ROWS);
      const range = strings.rowRange(String(from + 1), String(from + page.length));
      pages.push({ key: from, slots: page, label: range, spoken: range });
    }
    return pages;
  }
  const period = PAGE_PERIOD[domain.interval];
  const pages = new Map<number, number[]>();
  for (const slot of slots) {
    const start = slotStart(domain.starts[slot] ?? 0, period, domain.timeZone);
    const page = pages.get(start);
    if (page === undefined) pages.set(start, [slot]);
    else page.push(slot);
  }
  return [...pages].map(([key, list]) => {
    const label = formatSlot(locale, domain.timeZone, key, period, PAGE_LABEL[period], "full");
    return { key, slots: list, label: label.text, spoken: label.spoken };
  });
}

/** The slots and pages of one model in one locale. */
type TableIndex = { readonly slots: readonly number[]; readonly pages: readonly ChartTablePage[] };

/**
 * Each model's table index per locale. The slots and pages read the whole domain, so they wait for
 * a new model or locale, and a new window of the same data reuses them.
 */
const tableIndexes = new WeakMap<CartesianModel, Map<SupportedLocale, TableIndex>>();

/** The table index of a model in a locale, built on first read. */
function tableIndexOf(model: CartesianModel, locale: SupportedLocale): TableIndex {
  let byLocale = tableIndexes.get(model);
  if (byLocale === undefined) {
    byLocale = new Map();
    tableIndexes.set(model, byLocale);
  }
  let index = byLocale.get(locale);
  if (index === undefined) {
    const slots = tableSlots(model);
    index = { slots, pages: tablePages(model, locale, slots) };
    byLocale.set(locale, index);
  }
  return index;
}

/** What the table reads: the series model's words, the chart's name and the Root's rows. */
type SeriesTableContext = TextContext & {
  readonly name: string | undefined;
  readonly rows: readonly ChartRow[];
};

/** The caption: the chart name and the period the rows span. */
function captionText(context: SeriesTableContext, slots: readonly number[]): string {
  const { domain } = context.model;
  const first = slots[0] ?? 0;
  const last = slots.at(-1) ?? first;
  let period: string;
  if (domain.kind === "category") {
    period = CHART_STRINGS[context.locale].valueRange(domain.names[first] ?? "", domain.names[last] ?? "");
  } else {
    const options: Intl.DateTimeFormatOptions =
      domain.interval === "year"
        ? { year: "numeric" }
        : domain.interval === "month"
          ? { month: "long", year: "numeric" }
          : { day: "numeric", month: "long", year: "numeric" };
    const label = (slot: number) =>
      formatSlot(context.locale, domain.timeZone, domain.starts[slot] ?? 0, domain.interval, options, "full")
        .text;
    const from = label(first);
    const to = label(last);
    period = from === to ? from : CHART_STRINGS[context.locale].valueRange(from, to);
  }
  return context.name === undefined ? period : `${context.name}, ${period}`;
}

/** The first column's header, which the interval picks. */
function xHeaderText(context: TextContext): string {
  const strings = CHART_STRINGS[context.locale];
  const { domain } = context.model;
  if (domain.kind === "category") return strings.xHeaderCategory;
  switch (domain.interval) {
    case "second":
    case "minute":
    case "quarter-hour":
    case "hour":
      return strings.xHeaderTime;
    case "day":
      return strings.xHeaderDay;
    case "week":
      return strings.xHeaderWeek;
    case "month":
      return strings.xHeaderMonth;
    case "year":
      return strings.xHeaderYear;
  }
}

/** A series column's header, the label followed by the format's unit. */
function seriesHeader(context: TextContext, key: string): FormattedText {
  const label = seriesLabel(context, key);
  const unit = formatUnitLabel(context.locale, context.config[key]?.format ?? {});
  if (unit === null) return label;
  return { text: `${label.text} (${unit.text})`, spoken: `${label.spoken} (${unit.spoken})` };
}

/**
 * One series cell: the unitless value with its quality and projection words, the missing dash, or
 * the pending word for screen readers alone. A cell that a coarse series' span above covers renders
 * nothing.
 */
function seriesCell(context: TextContext, key: string, slot: number, rows: number): ChartTableCell {
  if (rows === 0) return { kind: "covered", key };
  const strings = CHART_STRINGS[context.locale];
  const series = seriesOf(context.model, key);
  const reading = series?.readings[slot];
  if (series === undefined || reading === undefined || reading.kind === "pending") {
    return { kind: "silent", key, spoken: strings.pending, rows };
  }
  if (reading.kind === "missing") {
    return { kind: "value", key, text: { text: "–", spoken: strings.missing }, words: [], rows };
  }
  const value = formatUnitless(context.locale, reading.value, context.config[key]?.format ?? {});
  const words = qualityWords(context.locale, reading.quality, slot >= series.projectedFrom);
  return { kind: "value", key, text: value, words, rows };
}

/** One stack's total cell: the sum of the present parts, with the incomplete word for a missing part. */
function totalCell(
  context: TextContext,
  stack: string,
  keys: readonly string[],
  slot: number
): ChartTableCell {
  const strings = CHART_STRINGS[context.locale];
  const sum = stackTotalAt(context.model, keys, slot);
  const key = `total-${stack}`;
  if (sum === null)
    return { kind: "value", key, text: { text: "–", spoken: strings.missing }, words: [], rows: 1 };
  const value = formatUnitless(context.locale, sum.total, context.config[keys[0] ?? ""]?.format ?? {});
  return { kind: "value", key, text: value, words: sum.incomplete ? [strings.incomplete] : [], rows: 1 };
}

/**
 * A series model's table: every slot of the full data that holds a reading or a missing reading,
 * paged past 500 rows by calendar period or by 500 categories, with one column per series and per
 * multi-series stack total. It builds rows for the shown page alone.
 *
 * @param context - The series model's words, the chart's name and the Root's rows.
 * @param keys - The React key each domain slot's row renders under, by slot index.
 * @returns The table model.
 */
export function seriesTable(context: SeriesTableContext, keys: readonly string[]): ChartTableModel {
  const { model, locale } = context;
  const strings = CHART_STRINGS[locale];
  return {
    pages: () => tableIndexOf(model, locale).pages,
    caption: () => captionText(context, tableIndexOf(model, locale).slots),
    xHeader: () => xHeaderText(context),
    heads: () => [
      ...model.series.map(({ key }) => seriesHeader(context, key)),
      ...model.stacks.map(({ id }): FormattedText => {
        const text = model.stacks.length > 1 ? `${strings.total} ${id}` : strings.total;
        return { text, spoken: text };
      }),
    ],
    rows: (page) => {
      // A coarse cell spans the rows of its slot, so each coarse value appears once.
      const spans = new Map(
        model.series.flatMap(({ key, coarse }) =>
          coarse === undefined ? [] : [[key, rowSpans(page.slots, coarse)] as const]
        )
      );
      return page.slots.map((slot, row): ChartTableRow => ({
        key: keys[slot] ?? slot,
        slot,
        head: slotLabel(context, slot),
        cells: [
          ...model.series.map(({ key }) => seriesCell(context, key, slot, spans.get(key)?.[row] ?? 1)),
          ...model.stacks.map(({ id, keys: parts }) => totalCell(context, id, parts, slot)),
        ],
      }));
    },
    cell: (slot, column) => {
      const index = model.rowAt[slot];
      return index === undefined ? undefined : context.rows[index]?.[column];
    },
    hasColumn: (column) => context.rows.some((entry) => Object.hasOwn(entry, column)),
    timeZone: model.domain.kind === "time" ? model.domain.timeZone : "UTC",
  };
}
