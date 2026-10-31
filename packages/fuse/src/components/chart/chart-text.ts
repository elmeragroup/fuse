"use client";

/**
 * The spoken text of a cartesian chart, as CONTRACT section 9.3 and section 9.4 define it. The
 * option names the active slot and the readings at it, and the description states the facts of the
 * effective window. Both read the spoken forms of layer 03's format modules, so a reader hears the
 * same unit and range words the table speaks.
 */
import type { SupportedLocale } from "../../intl/locale-context";
import type { EmphasisEntry } from "./chart-store";
import type { ChartSeriesConfig, XFormat } from "./chart-types";
import { CHART_STRINGS, countSlots } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { formatSlot, LABEL_PRESETS, wallClock } from "./format/time-format";
import type { Interval } from "./format/time-format";
import { formatUnitLabel, formatUnitless, formatValue } from "./format/value-format";
import { CHART_WORDS } from "./format/words";
import type { CartesianModel } from "./layout/cartesian-model";
import { ownWindowSlots } from "./layout/coarse-slots";
import type { Reading, ReadingQuality } from "./layout/readings";
import { seriesOf } from "./layout/series-of";

/** What the text builders read beside the model. */
export type TextContext = {
  readonly locale: SupportedLocale;
  readonly model: CartesianModel;
  readonly config: { readonly [key: string]: ChartSeriesConfig };
  /** Root's `xFormat`, which overrides the interval's label preset. */
  readonly xFormat: XFormat | undefined;
  readonly now: number | undefined;
};

/** The intervals finer than a day, whose labels name a time of day and no date. */
const SUB_DAY: ReadonlySet<string> = new Set(["second", "minute", "quarter-hour", "hour"]);

/** A slot's date with its year, the `date` preset's fields plus the year. */
const DATE_WITH_YEAR = { weekday: "long", day: "numeric", month: "long", year: "numeric" } as const;

/** Whether a time domain covers more than one local date, and more than one calendar year. */
type DomainSpan = { readonly dates: boolean; readonly years: boolean };

/** Which calendar spans a time domain covers in its zone. */
function domainSpan(model: CartesianModel): DomainSpan {
  const { domain } = model;
  if (domain.kind === "category") return { dates: false, years: false };
  const first = domain.starts[0];
  const last = domain.starts.at(-1);
  if (first === undefined || last === undefined) return { dates: false, years: false };
  const from = wallClock(first, domain.timeZone);
  const to = wallClock(last, domain.timeZone);
  return {
    dates: from.year !== to.year || from.month !== to.month || from.day !== to.day,
    years: from.year !== to.year,
  };
}

/**
 * The date of an instant in the domain's zone, in the `date` preset's form, with its year when the
 * domain spans more than one calendar year.
 */
function dateAt(context: TextContext, timeZone: string, start: number): FormattedText {
  const format = domainSpan(context.model).years ? DATE_WITH_YEAR : "date";
  return formatSlot(context.locale, timeZone, start, "day", format, "full");
}

/** A slot's date, as `dateAt` gives it for the slot's start. */
function slotDate(context: TextContext, slot: number): FormattedText {
  const { domain } = context.model;
  if (domain.kind === "category") return { text: "", spoken: "" };
  return dateAt(context, domain.timeZone, domain.starts[slot] ?? 0);
}

/**
 * The label of an interval that starts at an instant, in the interval's label preset or a given
 * format. On a domain that spans more than one local date, an interval finer than a day leads with
 * its date, and a date carries its year when the domain spans more than one calendar year, as
 * CONTRACT section 9.4 says. An explicit format replaces both.
 */
function datedLabel(
  context: TextContext,
  timeZone: string,
  start: number,
  interval: Interval,
  format: XFormat | undefined
): FormattedText {
  const span = domainSpan(context.model);
  if (format === undefined && interval === "day" && span.years) return dateAt(context, timeZone, start);
  const label = formatSlot(
    context.locale,
    timeZone,
    start,
    interval,
    format ?? LABEL_PRESETS[interval],
    "full"
  );
  if (format !== undefined || !SUB_DAY.has(interval) || !span.dates) return label;
  const date = dateAt(context, timeZone, start);
  const join = CHART_WORDS[context.locale].slotOnDate;
  return { text: join(date.text, label.text), spoken: join(date.spoken, label.spoken) };
}

/**
 * A slot's label, in the interval's label preset or Root's `xFormat`, or the category itself. On a
 * domain that spans more than one local date, a slot finer than a day leads with its date, and a
 * date carries its year when the domain spans more than one calendar year, as CONTRACT section
 * 9.4 says. An explicit format replaces both.
 *
 * @param context - The model and the locale.
 * @param slot - A slot index.
 * @param format - A preset or Intl options that replace the default.
 * @returns The visual and spoken label.
 */
export function slotLabel(context: TextContext, slot: number, format?: XFormat): FormattedText {
  const { domain } = context.model;
  if (domain.kind === "category") {
    const name = domain.names[slot] ?? "";
    return { text: name, spoken: name };
  }
  return datedLabel(
    context,
    domain.timeZone,
    domain.starts[slot] ?? 0,
    domain.interval,
    format ?? context.xFormat
  );
}

/**
 * The label of a coarse series' own slot that holds a Root slot, in its interval's label preset,
 * such as the hour `02–03` that holds the quarter 02:15. A series on Root's interval has none,
 * because the option and the tooltip already name the slot.
 *
 * @param context - The model and the locale.
 * @param key - A config key.
 * @param slot - A Root slot.
 * @returns The visual and spoken label, or null for a series on Root's grid.
 */
export function ownSlotLabel(context: TextContext, key: string, slot: number): FormattedText | null {
  const { domain } = context.model;
  const coarse = seriesOf(context.model, key)?.coarse;
  if (coarse === undefined || domain.kind !== "time") return null;
  const start = domain.starts[coarse.first[slot] ?? slot] ?? 0;
  return formatSlot(
    context.locale,
    domain.timeZone,
    start,
    coarse.interval,
    LABEL_PRESETS[coarse.interval],
    "full"
  );
}

/**
 * The dated label of a coarse series' own slot that holds a Root slot, for the description: its
 * interval's label from the slot's own start, with the date and year that `slotLabel` adds on a
 * domain of more than one date or year, such as `onsdag 1. oktober, kl. 00 til 01`. Tooltip rows
 * keep `ownSlotLabel`'s compact form beside their dated slot.
 *
 * @param context - The model and the locale.
 * @param key - A config key.
 * @param slot - A Root slot.
 * @returns The visual and spoken label, or null for a series on Root's grid.
 */
function ownSlotDated(context: TextContext, key: string, slot: number): FormattedText | null {
  const { domain } = context.model;
  const coarse = seriesOf(context.model, key)?.coarse;
  if (coarse === undefined || domain.kind !== "time") return null;
  return datedLabel(context, domain.timeZone, coarse.start[slot] ?? 0, coarse.interval, undefined);
}

/**
 * A series' name. A plain string reads verbatim in both forms, and a `FormattedText` keeps its
 * spoken form for options, the description and the table.
 *
 * @param context - The config.
 * @param key - A config key.
 * @returns The visual and spoken name.
 */
export function seriesLabel(context: TextContext, key: string): FormattedText {
  const label = context.config[key]?.label ?? key;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: a config label is a string or a FormattedText
  return typeof label === "string" ? { text: label, spoken: label } : label;
}

/**
 * A value as the series' format prints it.
 *
 * @param context - The config and the locale.
 * @param key - A config key.
 * @param value - The value.
 * @returns The visual and spoken value.
 */
export function valueLabel(context: TextContext, key: string, value: number): FormattedText {
  return formatValue(context.locale, value, context.config[key]?.format ?? {}, "full");
}

/**
 * The words a reading appends for its quality and its projection, in that order, which the
 * options, the description, the tooltip and the table all print.
 *
 * @param locale - The locale.
 * @param quality - The reading's quality.
 * @param projected - Whether the slot lies at or after config `projectedFrom`.
 * @returns The words, none for a measured reading before the projection.
 */
export function qualityWords(locale: SupportedLocale, quality: ReadingQuality, projected: boolean): string[] {
  const strings = CHART_STRINGS[locale];
  const words: string[] = [];
  if (quality === "estimated") words.push(strings.estimated);
  if (quality === "corrected") words.push(strings.corrected);
  if (projected) words.push(strings.projected);
  return words;
}

/** The words a reading speaks after its series name, with its quality and projection words. */
function readingWords(
  context: TextContext,
  key: string,
  reading: Reading | undefined,
  projected: boolean
): string {
  const strings = CHART_STRINGS[context.locale];
  if (reading === undefined || reading.kind === "pending") return strings.pending;
  if (reading.kind === "missing") return strings.missing;
  return [
    valueLabel(context, key, reading.value).spoken,
    ...qualityWords(context.locale, reading.quality, projected),
  ].join(", ");
}

/**
 * One stack's net total at a slot, the sum of its present parts. The options, the description and
 * TooltipTotal all read this one sum.
 *
 * @param model - The Root's model.
 * @param keys - The stack's keys.
 * @param slot - A slot index.
 * @returns The total and whether a part is missing, or null when no part has a reading.
 */
export function stackTotalAt(
  model: CartesianModel,
  keys: readonly string[],
  slot: number
): { readonly total: number; readonly incomplete: boolean } | null {
  let total = 0;
  let present = 0;
  for (const key of keys) {
    const reading = seriesOf(model, key)?.readings[slot];
    if (reading?.kind !== "reading") continue;
    total += reading.value;
    present += 1;
  }
  return present === 0 ? null : { total, incomplete: present < keys.length };
}

/** A stack's spoken name, its id only when the chart holds more than one stack. */
function stackName(context: TextContext, id: string): string {
  const strings = CHART_STRINGS[context.locale];
  return context.model.stacks.length > 1 ? `${strings.total} ${id}` : strings.total;
}

/**
 * Each multi-series stack's total at a slot, as the option ends with them under "all series"
 * focus. A total with a missing part sums the present parts and adds the incomplete word.
 */
function stackTotals(context: TextContext, slot: number): string[] {
  const strings = CHART_STRINGS[context.locale];
  return context.model.stacks.flatMap(({ id, keys }) => {
    const sum = stackTotalAt(context.model, keys, slot);
    if (sum === null) return [];
    const value = valueLabel(context, keys[0] ?? "", sum.total).spoken;
    return [`${stackName(context, id)} ${value}${sum.incomplete ? `, ${strings.incomplete}` : ""}`];
  });
}

/** Whether `now` lies in the slot. */
function holdsNow(context: TextContext, slot: number): boolean {
  const { domain } = context.model;
  if (domain.kind !== "time" || context.now === undefined) return false;
  const start = domain.starts[slot] ?? 0;
  const end = domain.ends[slot] ?? start;
  return start <= context.now && context.now < end;
}

/** How the option orders its parts. */
export type OptionOrder = "slot-first" | "series-first";

/**
 * The option's name for one slot.
 *
 * Under "all series" focus it names every series at the slot. With one series focused it names
 * that series. Right after Up or Down it speaks the series first, so the part that changed comes
 * first. A slot where every series is pending reads the pending word once.
 *
 * @param context - The model, config, locale and `now`.
 * @param slot - The active slot.
 * @param focus - The focused series by config order, or -1 for all series.
 * @param order - `series-first` right after Up or Down.
 * @returns The spoken option name.
 */
export function optionName(
  context: TextContext,
  slot: number,
  focus: number,
  order: OptionOrder,
  emphasis: { readonly [key: string]: EmphasisEntry } = {}
): string {
  const strings = CHART_STRINGS[context.locale];
  const label = slotLabel(context, slot).spoken;
  const x = holdsNow(context, slot) ? `${label}, ${strings.now}` : label;
  const { series } = context.model;
  const focused = focus === -1 ? series : series.filter(({ seriesIndex }) => seriesIndex === focus);
  const part = ({ key, readings, projectedFrom, coarse }: (typeof series)[number]): string => {
    const reading = readings[slot];
    const words = readingWords(context, key, reading, slot >= projectedFrom);
    const entry = emphasis[key];
    const first = coarse === undefined ? slot : (coarse.first[slot] ?? slot);
    const emphasised = reading?.kind === "reading" && entry?.slots.includes(first) === true;
    const tail = emphasised ? `, ${entry.label ?? strings.emphasised}` : "";
    // A coarse series names its own slot after its name, as `Forbruk kl. 02 til 03 0,35 kilowattimer`.
    const own = ownSlotLabel(context, key, slot);
    const name = seriesLabel(context, key).spoken;
    return `${own === null ? name : `${name} ${own.spoken}`} ${words}${tail}`;
  };
  const allPending = focused.every(({ readings }) => readings[slot]?.kind === "pending");
  const parts = allPending && focus === -1 ? [strings.pending] : focused.map(part);
  if (focus === -1 && !allPending) parts.push(...stackTotals(context, slot));
  const body = parts.join(", ");
  if (order === "series-first") {
    return focus === -1 ? `${strings.allSeries}, ${x}: ${body}` : `${body}, ${x}`;
  }
  return `${x}: ${body}`;
}

/** The first letter in upper case, as a sentence starts. */
function sentence(text: string, locale: SupportedLocale): string {
  const [first = "", ...rest] = text;
  return `${first.toLocaleUpperCase(locale)}${rest.join("")}`;
}

/** A description label with its unit, and the spoken form of each value after it. */
type UnitLabel = {
  /** The label, with the spoken unit when the format has one. */
  readonly label: string;
  /** A value's spoken text, unitless when the label carries the unit. */
  readonly value: (value: number) => string;
};

/**
 * A description label with the format's spoken unit, and the unitless spoken value that follows
 * it, as CONTRACT section 9.3 writes `Forbruk i kilowattimer: lavest 0,33`. A format with no unit
 * keeps the label and speaks each value whole.
 */
function withUnit(context: TextContext, key: string, label: string): UnitLabel {
  const format = context.config[key]?.format ?? {};
  const unit = formatUnitLabel(context.locale, format);
  if (unit === null) return { label, value: (value) => valueLabel(context, key, value).spoken };
  return {
    label: CHART_STRINGS[context.locale].descriptionLabel(label, unit.spoken),
    value: (value) => formatUnitless(context.locale, value, format).spoken,
  };
}

/**
 * The label a description span uses for a slot: the date for sub-day slots, with its year when the
 * domain spans more than one calendar year, else the slot label.
 */
function spanLabel(context: TextContext, slot: number): string {
  const { domain } = context.model;
  if (domain.kind === "category") return domain.names[slot] ?? "";
  return SUB_DAY.has(domain.interval) ? slotDate(context, slot).spoken : slotLabel(context, slot).spoken;
}

/**
 * The generated description of a cartesian chart, in spoken text. It states the window's span and
 * slot count, each series' lowest and highest reading with its slot, each stack's lowest and
 * highest total, the counts of missing, estimated and corrected readings, where a projection
 * starts, and the current slot when `now` lies in the window. Every fact covers the effective
 * window.
 *
 * @param context - The model, config, locale and `now`.
 * @returns The description.
 */
export function chartDescription(context: TextContext): string {
  const { locale, model } = context;
  const strings = CHART_STRINGS[locale];
  const { window, domain } = model;
  if (window === null || model.empty) return `${strings.noData}.`;
  const sentences: string[] = [];
  const from = spanLabel(context, window.first);
  const to = spanLabel(context, window.last);
  const unit = domain.kind === "time" ? domain.interval : "category";
  const count = countSlots(locale, window.last - window.first + 1, unit);
  sentences.push(sentence(strings.descriptionSpan(from, to === from ? undefined : to, count), locale));
  // The quality counts by the interval they count in: Root's, or a coarse series' own.
  const states = new Map<Interval | "category", { missing: number; estimated: number; corrected: number }>();
  for (const entry of model.series) {
    const { key, readings, coarse } = entry;
    const own = coarse?.interval ?? unit;
    const counts = states.get(own) ?? { missing: 0, estimated: 0, corrected: 0 };
    states.set(own, counts);
    let low: { slot: number; value: number } | undefined;
    let high: { slot: number; value: number } | undefined;
    // A coarse reading counts once, though every Root slot of its slot holds it.
    for (const slot of ownWindowSlots(entry, window)) {
      const reading = readings[slot];
      if (reading?.kind === "missing") counts.missing += 1;
      if (reading?.kind !== "reading") continue;
      if (reading.quality !== "measured") counts[reading.quality] += 1;
      if (low === undefined || reading.value < low.value) low = { slot, value: reading.value };
      if (high === undefined || reading.value > high.value) high = { slot, value: reading.value };
    }
    if (low === undefined || high === undefined) continue;
    const extremes = withUnit(context, key, seriesLabel(context, key).spoken);
    const at = (slot: number) => (ownSlotDated(context, key, slot) ?? slotLabel(context, slot)).spoken;
    sentences.push(
      strings.descriptionSeries(
        extremes.label,
        extremes.value(low.value),
        at(low.slot),
        extremes.value(high.value),
        at(high.slot)
      )
    );
  }
  // Each multi-series stack's lowest and highest total over the window, after the series.
  for (const { id, keys } of model.stacks) {
    let low: { slot: number; value: number } | undefined;
    let high: { slot: number; value: number } | undefined;
    for (let slot = window.first; slot <= window.last; slot += 1) {
      const sum = stackTotalAt(model, keys, slot);
      if (sum === null) continue;
      if (low === undefined || sum.total < low.value) low = { slot, value: sum.total };
      if (high === undefined || sum.total > high.value) high = { slot, value: sum.total };
    }
    if (low === undefined || high === undefined) continue;
    const totals = withUnit(context, keys[0] ?? "", stackName(context, id));
    sentences.push(
      strings.descriptionStack(
        totals.label,
        totals.value(low.value),
        slotLabel(context, low.slot).spoken,
        totals.value(high.value),
        slotLabel(context, high.slot).spoken
      )
    );
  }
  for (const state of ["missing", "estimated", "corrected"] as const) {
    for (const [interval, counts] of states) {
      if (counts[state] > 0)
        sentences.push(strings.descriptionQuality(countSlots(locale, counts[state], interval), state));
    }
  }
  // Where a projection starts inside the window.
  for (const { key, projectedFrom } of model.series) {
    if (projectedFrom > window.last) continue;
    const from = Math.max(projectedFrom, window.first);
    sentences.push(
      strings.descriptionProjection(seriesLabel(context, key).spoken, slotLabel(context, from).spoken)
    );
  }
  // The current slot, only when it lies in the window.
  if (domain.kind === "time" && context.now !== undefined) {
    const now = context.now;
    for (let slot = window.first; slot <= window.last; slot += 1) {
      const start = domain.starts[slot] ?? 0;
      if (start <= now && now < (domain.ends[slot] ?? start)) {
        sentences.push(strings.descriptionNow(slotLabel(context, slot).spoken));
        break;
      }
    }
  }
  return sentences.join(" ");
}
