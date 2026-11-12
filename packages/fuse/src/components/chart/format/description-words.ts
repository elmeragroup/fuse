/**
 * The pieces every family's generated description shares: a sentence's capital and a label that
 * states the values' unit once, so each value after it speaks unitless, after CONTRACT section 9.3.
 */
import type { SupportedLocale } from "../../../intl/locale-context";
import type { ValueFormat } from "../chart-types";
import { CHART_STRINGS } from "./chart-strings";
import { formatUnitLabel, formatUnitless } from "./value-format";

/**
 * Start a text as a sentence: its first letter in upper case.
 *
 * @param text - The text.
 * @param locale - The locale whose case rules apply.
 * @returns The text with its first letter in upper case.
 */
export function sentence(text: string, locale: SupportedLocale): string {
  const [first = "", ...rest] = text;
  return `${first.toLocaleUpperCase(locale)}${rest.join("")}`;
}

/** A description label with its unit, and the spoken form of each value after it. */
export type UnitLabel = {
  /** The label, with the spoken unit when the format has one. */
  readonly label: string;
  /** A value's spoken text, unitless when the label carries the unit. */
  readonly value: (value: number) => string;
};

/**
 * A description label with the format's spoken unit, and the unitless spoken value that follows
 * it, as `Forbruk i kilowattimer: lavest 0,33`. A format with no unit keeps the label and speaks
 * each value whole.
 *
 * @param locale - The active supported locale.
 * @param format - The values' format.
 * @param label - The label, such as the series' name.
 * @param whole - A value's whole spoken text, which a format with no unit speaks.
 * @returns The label and the values' spoken form.
 */
export function unitLabel(
  locale: SupportedLocale,
  format: ValueFormat,
  label: string,
  whole: (value: number) => string
): UnitLabel {
  const unit = formatUnitLabel(locale, format);
  if (unit === null) return { label, value: whole };
  return {
    label: CHART_STRINGS[locale].descriptionLabel(label, unit.spoken),
    value: (value) => formatUnitless(locale, value, format).spoken,
  };
}
