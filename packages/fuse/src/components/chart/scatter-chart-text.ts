"use client";

/**
 * The words a scatter chart prints and speaks: a series' label, a point's x and y in their formats,
 * the option's name and the generated description. The module calls no hook, so the server reads
 * it too.
 */
import { numberFormat } from "../../internal/intl-cache";
import { canonicalSpaces } from "../../intl/canonical-spaces";
import type { SupportedLocale } from "../../intl/locale-context";
import type { ChartConfig, ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText, LabelRole } from "./format/formatted-text";
import { inflect } from "./format/inflection";
import { formatValue } from "./format/value-format";
import { pointOf } from "./layout/scatter-model";
import type { ScatterModel } from "./layout/scatter-model";

/** What the scatter words read from Root. */
export type ScatterText = {
  readonly model: ScatterModel;
  readonly config: ChartConfig;
  readonly locale: SupportedLocale;
  readonly xFormat: ValueFormat;
  readonly valueFormat: ValueFormat;
  readonly xLabel: string | undefined;
  readonly yLabel: string | undefined;
};

/**
 * A series' label from config, in both forms.
 *
 * @param text - The config.
 * @param key - A config key.
 * @returns The visual and spoken label, the key itself for a key config lacks.
 */
export function scatterSeriesLabel(text: Pick<ScatterText, "config">, key: string): FormattedText {
  const label = text.config[key]?.label ?? key;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: a config label is a string or a FormattedText
  return typeof label === "string" ? { text: label, spoken: label } : label;
}

/**
 * An x value in Root's `xFormat`.
 *
 * @param text - The locale and the format.
 * @param value - The x value.
 * @param role - "tick" for an axis label, "full" for a readout.
 * @returns The visual and spoken value.
 */
export function xValueText(
  text: Pick<ScatterText, "locale" | "xFormat">,
  value: number,
  role: LabelRole
): FormattedText {
  return formatValue(text.locale, value, text.xFormat, role);
}

/**
 * The y values' format for a series: its config `format`, or Root's `valueFormat`.
 *
 * @param text - The config and Root's format.
 * @param key - A config key, or undefined for the axis's own format.
 * @returns The format.
 */
export function yFormatOf(
  text: Pick<ScatterText, "config" | "valueFormat">,
  key: string | undefined
): ValueFormat {
  return (key === undefined ? undefined : text.config[key]?.format) ?? text.valueFormat;
}

/**
 * A y value in its series' format.
 *
 * @param text - The config, the locale and Root's format.
 * @param key - The series' config key.
 * @param value - The y value.
 * @param role - "tick" for an axis label, "full" for a readout.
 * @returns The visual and spoken value.
 */
export function yValueText(
  text: Pick<ScatterText, "config" | "locale" | "valueFormat">,
  key: string | undefined,
  value: number,
  role: LabelRole
): FormattedText {
  return formatValue(text.locale, value, yFormatOf(text, key), role);
}

/** The x and y measures' names. */
export type AxisNames = { readonly x: string; readonly y: string };

/**
 * The x and y measures' names: Root's `xLabel` and `yLabel`, or the dictionary's.
 *
 * @param text - The locale and Root's labels.
 * @returns Both names.
 */
export function axisNames(text: Pick<ScatterText, "locale" | "xLabel" | "yLabel">): AxisNames {
  const strings = CHART_STRINGS[text.locale];
  return { x: text.xLabel ?? strings.xValue, y: text.yLabel ?? strings.yValue };
}

/**
 * The single option's name for a point: its series, then its x and y with their names when Root
 * names them, as `Forbruk 2026, Ukemiddeltemperatur: 3,6 °C, kWh per uke: 121 000 kWh`.
 *
 * @param text - The Root's words.
 * @param id - The point.
 * @returns The spoken name.
 */
export function scatterOptionName(text: ScatterText, id: number): string {
  const point = pointOf(text.model, id);
  const x = xValueText(text, point.x, "full").spoken;
  const y = yValueText(text, point.key, point.y, "full").spoken;
  const series = scatterSeriesLabel(text, point.key).spoken;
  const xPart = text.xLabel === undefined ? x : `${text.xLabel}: ${x}`;
  const yPart = text.yLabel === undefined ? y : `${text.yLabel}: ${y}`;
  return `${series}, ${xPart}, ${yPart}`;
}

/**
 * A count of points in words, such as `52 punkter`.
 *
 * @param locale - The active supported locale.
 * @param count - The number of points.
 * @returns The count and its word in the locale's plural form.
 */
export function countPoints(locale: SupportedLocale, count: number): string {
  const number = canonicalSpaces(numberFormat(locale, {}).format(count));
  return `${number} ${inflect(locale, count, CHART_STRINGS[locale].points)}`;
}

/**
 * The generated description: one sentence per series with points, its label, its point count and
 * the ranges its x and y values span, each in its format.
 *
 * @param text - The Root's words.
 * @returns The description.
 */
export function scatterDescription(text: ScatterText): string {
  const strings = CHART_STRINGS[text.locale];
  const names = axisNames(text);
  return text.model.series
    .filter(({ xs }) => xs.length > 0)
    .map((series) => {
      let low = Number.POSITIVE_INFINITY;
      let high = Number.NEGATIVE_INFINITY;
      for (const value of series.ys) {
        if (value < low) low = value;
        if (value > high) high = value;
      }
      const first = series.xs[0] ?? 0;
      const last = series.xs[series.xs.length - 1] ?? 0;
      const range = (from: FormattedText, to: FormattedText): string =>
        from.spoken === to.spoken ? from.spoken : strings.valueRange(from.spoken, to.spoken);
      const x = `${names.x} ${range(xValueText(text, first, "full"), xValueText(text, last, "full"))}`;
      const y = `${names.y} ${range(
        yValueText(text, series.key, low, "full"),
        yValueText(text, series.key, high, "full")
      )}`;
      return strings.scatterSeries(
        scatterSeriesLabel(text, series.key).spoken,
        countPoints(text.locale, series.xs.length),
        x,
        y
      );
    })
    .join(" ");
}

/**
 * The first point a walk shows: the first point in the walk order, or -1 for an empty chart.
 *
 * @param model - The model.
 * @returns The point id, or -1.
 */
export function firstPoint(model: ScatterModel): number {
  return model.empty ? -1 : (model.order[0] ?? -1);
}
