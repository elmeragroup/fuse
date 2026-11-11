"use client";

import { countOf } from "../../intl/count-of";
/**
 * The words a scatter chart prints and speaks: a series' label, a point's x and y in their formats,
 * the option's name and the generated description. The module calls no hook, so the server reads
 * it too.
 */
import type { SupportedLocale } from "../../intl/locale-context";
import type { ChartConfig, ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText, LabelRole } from "./format/formatted-text";
import { seriesLabel } from "./format/series-label";
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
 * The single option's name for a point: its series, then its x and y, each after its name from
 * `axisNames`, so Root's `xLabel` and `yLabel` win and the dictionary's "x-verdi" and "y-verdi"
 * name them otherwise, as `Forbruk 2026, Ukemiddeltemperatur: 3,6 °C, kWh per uke: 121 000 kWh`.
 *
 * @param text - The Root's words.
 * @param id - The point.
 * @returns The spoken name.
 */
export function scatterOptionName(text: ScatterText, id: number): string {
  const point = pointOf(text.model, id);
  const x = xValueText(text, point.x, "full").spoken;
  const y = yValueText(text, point.key, point.y, "full").spoken;
  const series = seriesLabel(text, point.key).spoken;
  const names = axisNames(text);
  return `${series}, ${names.x}: ${x}, ${names.y}: ${y}`;
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
        seriesLabel(text, series.key).spoken,
        countOf(text.locale, series.xs.length, strings.points),
        x,
        y
      );
    })
    .join(" ");
}
