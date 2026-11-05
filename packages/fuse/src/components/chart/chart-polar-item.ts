"use client";

/**
 * The item adapter, which Pie and Radial read their Root through. An index is an item: a kept
 * category or Other on a pie, a ring on a radial chart. The legend lists the items, Other last,
 * the tooltip shows the active item alone, a pie share is one largest-remainder set over the
 * absolute total and a ring share its value over its own maximum, and the table lists the rows
 * unfolded. CONTRACT sections 8.4, 8.13 and 9.4 give the rules.
 */
import type { ReactNode } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import type { CentreModel, PolarIssue, PolarKernel, PolarModel } from "./chart-polar-context";
import type { ChartReadout, ChartTableCell, ChartTableModel, ReadoutItem } from "./chart-readout-port";
import type { ChartConfig, ChartQuality, ChartRow, ValueFormat } from "./chart-types";
import { CHART_STRINGS, countOf } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { POLAR_STRINGS } from "./format/polar-strings";
import { seriesLabel } from "./format/series-label";
import { formatUnitLabel, formatUnitless, formatValue } from "./format/value-format";
import { isRoleList, seriesPaint, singleRole } from "./layout/color-key";
import {
  assertKnownKey,
  ChartDataError,
  DATA_MESSAGES,
  dataMessage,
  isChartDevelopment,
  issueGroups,
} from "./layout/errors";
import { foldPie, gaugeFill, OTHER_KEY, pieAngles, sliceAt } from "./layout/pie";
import type { PieRole, SliceAngles } from "./layout/pie";
import { angleInSweep, pointerAngle } from "./layout/polar-angle";
import type { Sweep } from "./layout/polar-angle";
import { readSeries } from "./layout/readings";
import type { Reading } from "./layout/readings";
import { ringAngle, ringAt, ringBands, ringFills } from "./layout/rings";
import type { RingBand, RingFill, RingMaxima } from "./layout/rings";
import { stringOf } from "./layout/scalar";
import { roundShares } from "./layout/shares";

/** One item the readout steps through: a kept category, Other or a ring. */
export type PolarItem = {
  readonly key: string;
  readonly label: FormattedText;
  /** The reading the texts print, its sign kept, or null for a missing one. */
  readonly value: number | null;
  readonly quality: "estimated" | "corrected" | "missing" | undefined;
  readonly format: ValueFormat;
  readonly icon: ReactNode;
  /** The paint a swatch and a mark read. */
  readonly paint: string;
  /** The rows the item stands for, by index into Root's data. */
  readonly rows: readonly number[];
};

/** What every item model reads from its Root. */
export type ItemInput = {
  readonly rows: readonly ChartRow[];
  readonly config: ChartConfig;
  readonly nameKey: string;
  readonly valueKey: string;
  readonly qualityKey: string | undefined;
  readonly valueFormat: ValueFormat | undefined;
  readonly sweep: Sweep;
  readonly locale: SupportedLocale;
  /** Root's `aria-label`, which the table's caption reads. */
  readonly name: string | undefined;
  /** The Root's display name, which the errors name. */
  readonly part: string;
};

/** One row as the items read it: its category, its reading and whether config holds the category. */
type ItemRow = {
  readonly category: string;
  readonly reading: Reading;
  readonly known: boolean;
};

/** A reading's quality state, or undefined for a measured or pending one. */
function qualityOf(reading: Reading): "estimated" | "corrected" | "missing" | undefined {
  if (reading.kind === "missing") return "missing";
  if (reading.kind === "reading" && reading.quality !== "measured") return reading.quality;
  return undefined;
}

/** A reading's value, or null for a missing or pending one. */
function valueOf(reading: Reading): number | null {
  return reading.kind === "reading" ? reading.value : null;
}

/**
 * Read the rows: each row's category and reading. A cell that breaks a reading rule, such as a value
 * that is not a finite number, throws that rule in development, and production counts the reading
 * as missing and warns once. A negative reading throws `negative-polar-value` in development, and
 * production draws it as 0 and keeps its sign in the texts. A category config lacks throws
 * `unknown-category` in development.
 */
function readRows(input: ItemInput, issues: PolarIssue[]): ItemRow[] {
  const { rows, config, nameKey, valueKey, qualityKey, part } = input;
  const { readings, issues: cells } = readSeries(
    {
      values: rows.map((row) => row[valueKey]),
      qualities: qualityKey === undefined ? [] : rows.map((row) => row[qualityKey]),
    },
    undefined,
    undefined
  );
  const categoryAt = (index: number): string => {
    const row = rows[index];
    return row === undefined ? "" : (stringOf(row[nameKey]) ?? String(row[nameKey] ?? ""));
  };
  // A cell that breaks a reading rule throws in development, as Chart's do, and production keeps
  // the fallback the rule names and warns once per rule and category, naming the first row.
  const named = cells.map((issue) => ({ ...issue, key: categoryAt(issue.slot) }));
  const rowAt = rows.map((_, index) => index);
  const [first] = named;
  if (first !== undefined && isChartDevelopment()) {
    throw new ChartDataError(part, first.rule, dataMessage(first, rowAt));
  }
  for (const { rule, subject, first: issue, count } of issueGroups(named)) {
    issues.push({ rule, subject, message: `${part} ${dataMessage(issue, rowAt, count)}` });
  }
  return rows.map((row, index) => {
    const category = categoryAt(index);
    const reading = readings[index] ?? { kind: "missing" };
    if (reading.kind === "reading" && reading.value < 0) {
      const message = DATA_MESSAGES["negative-polar-value"];
      if (isChartDevelopment()) throw new ChartDataError(part, "negative-polar-value", message);
      issues.push({ rule: "negative-polar-value", subject: category, message: `${part} ${message}` });
    }
    const known = Object.hasOwn(config, category);
    if (!known) {
      const message = DATA_MESSAGES["unknown-category"];
      if (isChartDevelopment()) throw new ChartDataError(part, "unknown-category", message);
      issues.push({ rule: "unknown-category", subject: category, message: `${part} ${message}` });
    }
    return { category, reading, known };
  });
}

/** A category's paint, the consumer's `--chart-color-<key>` first. */
function paintOf(config: ChartConfig, key: string): string {
  return seriesPaint(key, singleRole(config[key]?.color));
}

/** A value's text with its quality word, in both forms, or the missing word. */
function valueText(locale: SupportedLocale, item: PolarItem, format: ValueFormat | undefined): FormattedText {
  const strings = CHART_STRINGS[locale];
  if (item.value === null) return { text: strings.missing, spoken: strings.missing };
  const value = formatValue(locale, item.value, format ?? item.format, "full");
  if (item.quality === undefined || item.quality === "missing") return value;
  const word = strings[item.quality];
  return { text: `${value.text} (${word})`, spoken: `${value.spoken}, ${word}` };
}

/** A share in percent as text in both forms, or the dictionary dash. */
function shareWords(locale: SupportedLocale, share: number | null, digits: number): FormattedText {
  if (share === null) return { text: "–", spoken: "–" };
  return formatValue(
    locale,
    share / 100,
    { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: digits },
    "full"
  );
}

/** What the item readout and table read beside the items. */
type ItemSource = {
  readonly items: readonly PolarItem[];
  readonly rows: readonly ItemRow[];
  readonly input: ItemInput;
  /** Each item's share in percent at some digits, or null where it has none. */
  readonly share: (index: number, digits: number) => number | null;
  /** Each item's maximum, or null: a ring's, or a gauge's. */
  readonly max: (index: number) => number | null;
  /** Whether the table's third column holds shares or maxima. */
  readonly third: "share" | "max";
};

/** The readout over items. */
function itemReadout(source: ItemSource, kernel: PolarKernel, empty: boolean): ChartReadout {
  const { items, input } = source;
  const { locale } = input;
  const indexOf = new Map(items.map(({ key }, index) => [key, index]));
  const readoutItems = new Map(
    items.map((item, index): [string, ReadoutItem] => [
      item.key,
      {
        index,
        label: item.label,
        icon: item.icon,
        selectable: item.key !== OTHER_KEY && Object.hasOwn(input.config, item.key),
        sides: null,
      },
    ])
  );
  const itemAt = (key: string) => items[indexOf.get(key) ?? -1];
  return {
    id: kernel.id,
    name: kernel.name,
    locale,
    root: kernel.root,
    store: kernel.store,
    followers: kernel.followers,
    window: items.length === 0 ? null : { first: 0, last: items.length - 1 },
    empty,
    legendKeys: items.map(({ key }) => key),
    toggleGroupName: POLAR_STRINGS[input.locale].categoryGroup,
    item: (key) => readoutItems.get(key),
    assertKey: (part, key) => {
      // Other is no config key, so naming it fails as any other unknown key does.
      assertKnownKey(part, input.config, key);
    },
    pointKey: (active) => (active === null ? null : (items[active]?.key ?? null)),
    itemsFollowActive: true,
    tooltipKeys: (active) => {
      const item = active === null ? undefined : items[active];
      return item === undefined ? [] : [item.key];
    },
    activeLabel: (active) => items[active]?.label.text ?? "",
    valueText: (key, _at, format) => {
      const item = itemAt(key);
      return item === undefined ? "" : valueText(locale, item, format).text;
    },
    share: (key, _at, digits) => source.share(indexOf.get(key) ?? -1, digits),
    legendAt: (key) => indexOf.get(key) ?? null,
    legendShare: (key, digits) => source.share(indexOf.get(key) ?? -1, digits),
    swatch: (key) => ({ paint: itemAt(key)?.paint ?? "", look: undefined }),
    point: (active) => {
      const values: Record<string, number | null> = {};
      const quality: Record<string, ChartQuality> = {};
      for (const item of items) {
        // Other names no config key, so its value reads under its label.
        values[item.key === OTHER_KEY ? item.label.text : item.key] = item.value;
        // A reading with no quality state is measured; a pending one, with no value, has no entry.
        if (item.key === OTHER_KEY) continue;
        if (item.quality !== undefined) quality[item.key] = item.quality;
        else if (item.value !== null) quality[item.key] = "measured";
      }
      const item = items[active];
      return {
        index: active,
        x: item?.key === OTHER_KEY ? item.label.text : (item?.key ?? ""),
        label: item?.label ?? { text: "", spoken: "" },
        key: item === undefined || item.key === OTHER_KEY ? null : item.key,
        values,
        quality,
      };
    },
    select: kernel.select,
    registerToggleGroup: kernel.registerToggleGroup,
    highlight: kernel.highlight,
    warnOnce: kernel.warnOnce,
    usePick: kernel.usePick,
  };
}

/** Whether every item reads one format, so the table's headers carry the unit and the cells none. */
function sharedFormat(items: readonly { readonly format: ValueFormat }[]): ValueFormat | null {
  const [first] = items;
  if (first === undefined) return null;
  const key = JSON.stringify(first.format);
  return items.every(({ format }) => JSON.stringify(format) === key) ? first.format : null;
}

/** The rows of an item table: every original row unfolded, with its value and its share or maximum. */
function itemTable(source: ItemSource, rowShares: (digits: number) => (number | null)[]): ChartTableModel {
  const { rows, input } = source;
  const { locale, config, valueFormat } = input;
  const strings = CHART_STRINGS[locale];
  const polarStrings = POLAR_STRINGS[locale];
  const formatOf = (category: string): ValueFormat => config[category]?.format ?? valueFormat ?? {};
  const shared = sharedFormat(rows.map(({ category }) => ({ format: formatOf(category) })));
  const unit = shared === null ? null : formatUnitLabel(locale, shared);
  const header = (word: string): FormattedText =>
    unit === null
      ? { text: word, spoken: word }
      : { text: `${word} (${unit.text})`, spoken: `${word} (${unit.spoken})` };
  const numberCell = (
    key: string,
    value: number | null,
    format: ValueFormat,
    words: readonly string[]
  ): ChartTableCell => {
    if (value === null)
      return { kind: "value", key, text: { text: "–", spoken: strings.missing }, words: [], rows: 1 };
    const text =
      shared === null ? formatValue(locale, value, format, "full") : formatUnitless(locale, value, format);
    return { kind: "value", key, text, words, rows: 1 };
  };
  const page = { key: 0, slots: rows.map((_, index) => index), label: "", spoken: "" };
  return {
    pages: () => [page],
    caption: () => input.name ?? "",
    xHeader: () => strings.xHeaderCategory,
    heads: () => [
      header(polarStrings.valueHeader),
      source.third === "share"
        ? { text: polarStrings.shareHeader, spoken: polarStrings.shareHeader }
        : header(polarStrings.maxHeader),
    ],
    rows: () => {
      const shares = rowShares(0);
      return rows.map((row, index) => {
        const format = formatOf(row.category);
        const quality = qualityOf(row.reading);
        const words = quality === undefined || quality === "missing" ? [] : [strings[quality]];
        const third: ChartTableCell =
          source.third === "share"
            ? {
                kind: "value",
                key: "share",
                text: shareWords(locale, shares[index] ?? null, 0),
                words: [],
                rows: 1,
              }
            : numberCell("max", source.max(index), format, []);
        return {
          key: `${row.category}\u0000${String(index)}`,
          slot: index,
          head: row.known
            ? seriesLabel({ config }, row.category)
            : { text: row.category, spoken: row.category },
          cells: [numberCell("value", valueOf(row.reading), format, words), third],
        };
      });
    },
    cell: (slot, column) => input.rows[slot]?.[column],
    hasColumn: (column) => input.rows.some((row) => Object.hasOwn(row, column)),
    timeZone: "UTC",
  };
}

/** What a pie reads beside every item model's input. */
export type PieInput = ItemInput & {
  readonly maxSlices: number;
  /** The hole's radius as a share of the outer radius. */
  readonly innerRadius: number;
  readonly padAngle: number;
  /** A gauge's maximum, or undefined for a plain pie. */
  readonly max: number | undefined;
  readonly otherLabel: string | undefined;
};

/**
 * A pie's model: the folded items, their slices in the sweep, the shares, the option names, the
 * description, the pick by angle and the table.
 *
 * @param input - The Root's rows, config and props.
 * @returns The model.
 */
export function pieModel(input: PieInput): PolarModel {
  const { config, locale, valueFormat } = input;
  const strings = CHART_STRINGS[locale];
  const polarStrings = POLAR_STRINGS[locale];
  const issues: PolarIssue[] = [];
  const rows = readRows(input, issues);
  const roles = rows.map(({ category, known }): PieRole => {
    if (!known) return "unknown";
    return config[category]?.color === "chart-other" ? "other" : "own";
  });
  const folded = foldPie(
    rows.map(({ category, reading }, index) => ({
      key: category,
      value: valueOf(reading),
      role: roles[index] ?? "own",
    })),
    input.maxSlices
  );
  const items: PolarItem[] = folded.map(({ key, value, rows: members }) => {
    if (key === OTHER_KEY) {
      // Other's label is `otherLabel` or the dictionary's word, followed by its category count,
      // inflected, since one unknown category folds into Other alone.
      const word = input.otherLabel ?? strings.other;
      const label = `${word}, ${countOf(locale, members.length, strings.slots.category)}`;
      return {
        key,
        label: { text: label, spoken: label },
        value,
        quality: undefined,
        format: valueFormat ?? {},
        icon: undefined,
        paint: "var(--chart-other)",
        rows: members,
      };
    }
    const row = rows[members[0] ?? -1];
    return {
      key,
      label: seriesLabel({ config }, key),
      value,
      quality: row === undefined ? undefined : qualityOf(row.reading),
      format: config[key]?.format ?? valueFormat ?? {},
      icon: config[key]?.icon,
      paint: paintOf(config, key),
      rows: members,
    };
  });
  const drawn = items.map(({ value }) => (value !== null && value > 0 ? value : 0));
  const total = drawn.reduce((sum, value) => sum + value, 0);
  const gauge = input.max === undefined ? null : gaugeFill(input.sweep, total, input.max);
  const sweep = gauge?.sweep ?? input.sweep;
  const slices = pieAngles(drawn, sweep, input.padAngle);
  const shareSets = new Map<number, (number | null)[]>();
  const shares = (digits: number): (number | null)[] => {
    const known = shareSets.get(digits);
    if (known !== undefined) return known;
    const set = roundShares(
      items.map(({ value }) => value),
      digits
    );
    shareSets.set(digits, set);
    return set;
  };
  const rowShareSets = new Map<number, (number | null)[]>();
  const rowShares = (digits: number): (number | null)[] => {
    const known = rowShareSets.get(digits);
    if (known !== undefined) return known;
    const set = roundShares(
      rows.map(({ reading }) => valueOf(reading)),
      digits
    );
    rowShareSets.set(digits, set);
    return set;
  };
  const source: ItemSource = {
    items,
    rows,
    input,
    share: (index, digits) => (index < 0 ? null : (shares(digits)[index] ?? null)),
    max: () => input.max ?? null,
    third: "share",
  };
  const empty = total === 0 && items.every(({ value }) => value === null || value === 0);
  const totalText = formatValue(locale, total, sharedFormat(items) ?? valueFormat ?? {}, "full").spoken;
  const optionName = (index: number): string => {
    const item = items[index];
    if (item === undefined) return "";
    const value = valueText(locale, item, undefined).spoken;
    if (item.value === null) return `${item.label.spoken}: ${strings.missing}`;
    if (input.max !== undefined) {
      const max = formatValue(locale, input.max, item.format, "full").spoken;
      return `${item.label.spoken}: ${strings.ofMax(value, max)}`;
    }
    return `${item.label.spoken}: ${value}, ${shareWords(locale, source.share(index, 0), 0).spoken}`;
  };
  return {
    family: "pie",
    // The cell holds the whole sweep, a gauge's empty part included.
    sweep: input.sweep,
    count: items.length,
    keys: items.map(({ key }) => key),
    empty,
    description: empty
      ? `${strings.noData}.`
      : [
          polarStrings.descriptionPie(countOf(locale, items.length, polarStrings.slices), totalText),
          ...items.map((_, index) => `${optionName(index)}.`),
        ].join(" "),
    instructions: "polar",
    orientation: "vertical",
    wrap: true,
    series: 0,
    page: null,
    optionName,
    pick: (point, pixels) => {
      // The whole cell inside the sweep picks, the hole and the space past the rim too (Q8), over
      // the angles the frame painted, floored and seamed, where it painted them (D24).
      const drawn = slices.map((slice, index) => {
        const key = items[index]?.key;
        const angles = key === undefined ? undefined : pixels.painted?.(key);
        return angles === undefined ? slice : angles;
      });
      const index = sliceAt(pointerAngle(point.x, point.y), drawn, sweep);
      return index === null ? null : { slot: index, near: null };
    },
    ray: (index) => {
      const slice: SliceAngles | null | undefined = slices[index];
      if (slice === null || slice === undefined) return null;
      return { angle: (slice.start + slice.end) / 2, radius: 1 };
    },
    selectKey: (index) => {
      const key = items[index]?.key;
      return key === undefined || key === OTHER_KEY || !Object.hasOwn(config, key) ? null : key;
    },
    selectable: Object.keys(config),
    table: itemTable(source, rowShares),
    readout: (kernel) => itemReadout(source, kernel, empty),
    issues,
    drawing: {
      kind: "pie",
      pie: {
        track: input.sweep,
        fill: sweep,
        innerRadius: input.innerRadius,
        slices: items.map((item, index) => {
          const color = config[item.key]?.color;
          const role = item.key === OTHER_KEY ? "chart-other" : singleRole(color);
          return {
            key: item.key,
            label: item.label,
            role,
            paint: item.paint,
            stops:
              color !== undefined && isRoleList(color)
                ? color.map((stop) => seriesPaint(item.key, stop))
                : undefined,
            series: Object.keys(config).indexOf(item.key),
            value: item.value,
            format: item.format,
            angles: slices[index] ?? null,
            quality: item.quality,
          };
        }),
        total,
        totalFormat: sharedFormat(items) ?? null,
        max: input.max ?? null,
        over: gauge?.over ?? false,
        share: source.share,
        sliceOf: (category) => (folded.some(({ key }) => key === category) ? category : OTHER_KEY),
      },
      centre: {
        value: (index) => items[index]?.value ?? null,
        format: (index) => items[index]?.format ?? valueFormat ?? {},
        total: sharedFormat(items) === null ? null : { value: total, format: sharedFormat(items) ?? {} },
        share: source.share,
        // A gauge's own share rounds alone, as a ring's does.
        totalShare: (digits) =>
          input.max !== undefined && input.max > 0 ? rounded((total / input.max) * 100, digits) : null,
        max: () => input.max ?? null,
        totalMax: input.max ?? null,
      },
    },
  };
}

/** What a radial chart reads beside every item model's input. */
export type RadialInput = ItemInput & {
  readonly maxima: RingMaxima;
  /** The hole's radius as a share of the outer radius. */
  readonly innerRadius: number;
};

/** The share of each ring's band its stroke fills, `--chart-ring-fill`'s default (Q4). */
export const RING_FILL = 0.7;

/**
 * A radial chart's model: one ring per row, the first outermost, each filling its maximum, with the
 * option names, the description, the pick by radius band and the table.
 *
 * @param input - The Root's rows, config and props.
 * @returns The model.
 */
export function radialModel(input: RadialInput): PolarModel {
  const { config, locale, valueFormat, sweep } = input;
  const strings = CHART_STRINGS[locale];
  const polarStrings = POLAR_STRINGS[locale];
  const issues: PolarIssue[] = [];
  const rows = readRows(input, issues);
  const fills: readonly RingFill[] = ringFills(
    rows.map(({ reading }) => valueOf(reading)),
    input.maxima
  );
  const items: PolarItem[] = rows.map(({ category, reading, known }, index) => ({
    key: known ? category : `${OTHER_KEY}${String(index)}`,
    label: known ? seriesLabel({ config }, category) : { text: category, spoken: category },
    value: valueOf(reading),
    quality: qualityOf(reading),
    format: config[category]?.format ?? valueFormat ?? {},
    icon: config[category]?.icon,
    paint: known ? paintOf(config, category) : "var(--chart-other)",
    rows: [index],
  }));
  const bands: readonly RingBand[] = ringBands(items.length, {
    outer: 1,
    innerRadius: input.innerRadius,
    fill: RING_FILL,
  });
  const share = (index: number, digits: number): number | null => {
    const value = fills[index]?.share ?? null;
    return value === null ? null : rounded(value * 100, digits);
  };
  const source: ItemSource = {
    items,
    rows,
    input,
    share,
    max: (index) => fills[index]?.max ?? null,
    third: "max",
  };
  const empty = items.every(({ value }) => value === null);
  const optionName = (index: number): string => {
    const item = items[index];
    if (item === undefined) return "";
    if (item.value === null) return `${item.label.spoken}: ${strings.missing}`;
    const value = valueText(locale, item, undefined).spoken;
    const max = fills[index]?.max;
    if (max === null || max === undefined) return `${item.label.spoken}: ${value}`;
    return `${item.label.spoken}: ${strings.ofMax(value, formatValue(locale, max, item.format, "full").spoken)}`;
  };
  return {
    family: "radial",
    sweep,
    count: items.length,
    keys: items.map(({ key }) => key),
    empty,
    description: empty
      ? `${strings.noData}.`
      : [
          polarStrings.descriptionRadial(countOf(locale, items.length, polarStrings.rings)),
          ...items.map((_, index) => `${optionName(index)}.`),
        ].join(" "),
    instructions: "polar",
    orientation: "vertical",
    wrap: false,
    series: 0,
    page: null,
    optionName,
    pick: (point) => {
      if (angleInSweep(pointerAngle(point.x, point.y), sweep) === null) return null;
      const index = ringAt(Math.hypot(point.x, point.y), bands);
      return index === null ? null : { slot: index, near: null };
    },
    ray: (index) => {
      const fill = fills[index];
      const band = bands[index];
      if (fill === undefined || band === undefined) return null;
      return { angle: sweep.start + ringAngle(fill, sweep.width) * sweep.direction, radius: 1 };
    },
    selectKey: (index) => {
      const key = items[index]?.key;
      return key !== undefined && Object.hasOwn(config, key) ? key : null;
    },
    selectable: Object.keys(config),
    table: itemTable(source, (digits) => items.map((_, index) => share(index, digits))),
    readout: (kernel) => itemReadout(source, kernel, empty),
    issues,
    drawing: {
      kind: "radial",
      radial: {
        sweep,
        innerRadius: input.innerRadius,
        rings: items.map((item, index) => {
          const color = config[item.key]?.color;
          const fill = fills[index] ?? { max: null, share: null, over: false };
          return {
            key: item.key,
            label: item.label,
            paint: item.paint,
            stops:
              color !== undefined && isRoleList(color)
                ? color.map((stop) => seriesPaint(item.key, stop))
                : undefined,
            series: Object.keys(config).indexOf(item.key),
            quality: item.quality,
            band: bands[index] ?? { radius: 0, width: 0, inner: 0, outer: 0 },
            angle: ringAngle(fill, sweep.width),
            over: fill.over,
          };
        }),
      },
      centre: radialCentre(items, fills, share, valueFormat),
    },
  };
}

/**
 * A radial chart's centre: the active ring, or with nothing active the sum of the values over the
 * sum of the maxima when every ring shares one format (CONTRACT section 8.13).
 */
function radialCentre(
  items: readonly PolarItem[],
  fills: readonly RingFill[],
  share: (index: number, digits: number) => number | null,
  valueFormat: ValueFormat | undefined
): CentreModel {
  const format = sharedFormat(items);
  const sum = items.reduce((total, { value }) => total + (value !== null && value > 0 ? value : 0), 0);
  const maxima = fills.flatMap(({ max }) => (max === null ? [] : [max]));
  const maxSum = maxima.length === fills.length ? maxima.reduce((total, max) => total + max, 0) : null;
  return {
    value: (index) => items[index]?.value ?? null,
    format: (index) => items[index]?.format ?? valueFormat ?? {},
    total: format === null ? null : { value: sum, format },
    share,
    totalShare: (digits) =>
      format === null || maxSum === null || !(maxSum > 0) ? null : rounded((sum / maxSum) * 100, digits),
    max: (index) => fills[index]?.max ?? null,
    totalMax: format === null ? null : maxSum,
  };
}

/** A number rounded to `digits` fraction digits. */
function rounded(value: number, digits: number): number {
  const unit = 10 ** digits;
  return Math.round(value * unit) / unit;
}
