/**
 * Value labels for chart axes, tooltips, aria text and tables. A format is plain data, either Intl
 * number options or a named preset, so a server component can pass it to a client chart.
 */
import { numberFormat, pluralRules } from "../../../intl/intl-formatters";
import type { SupportedLocale } from "../../../intl/locale-context";
import { makeFormattedText } from "./formatted-text";
import type { FormattedText, LabelRole } from "./formatted-text";
import { CHART_WORDS } from "./words";
import type { ChartWords, Currency, EnergyUnit, PowerUnit, VatBasis } from "./words";

/** The fraction digits every preset accepts. */
type FractionDigits = {
  /** The fewest fraction digits to show. */
  readonly minimumFractionDigits?: number;
  /** The most fraction digits to show. */
  readonly maximumFractionDigits?: number;
};

/** Energy, such as `1 234,5 kWh`. The SI symbol is the same in every locale. */
export type EnergyFormat = FractionDigits & {
  /** Selects the energy preset. */
  readonly preset: "energy";
  /** The energy unit the value is in. */
  readonly unit: EnergyUnit;
};

/** Power, such as `3,2 kW`. The SI symbol is the same in every locale. */
export type PowerFormat = FractionDigits & {
  /** Selects the power preset. */
  readonly preset: "power";
  /** The power unit the value is in. */
  readonly unit: PowerUnit;
};

/**
 * A price per kilowatt-hour, such as `1,42 kr/kWh inkl. mva` or, with `minor`, `142,3 øre/kWh
 * inkl. mva`. Full labels name the VAT basis, because Norwegian consumer law requires every price
 * element to show. Fuse computes no VAT, so the basis is the data's own.
 */
export type UnitPriceFormat = FractionDigits & {
  /** Selects the unit-price preset. */
  readonly preset: "unit-price";
  /** The currency the value is in. */
  readonly currency: Currency;
  /** Whether the value is in the currency's subunit, such as øre or cents. */
  readonly minor?: boolean;
  /** Whether the value includes VAT. */
  readonly vat: VatBasis;
};

/** A value format, either Intl number options or one of Fuse's energy-market presets. */
export type ValueFormat = Intl.NumberFormatOptions | EnergyFormat | PowerFormat | UnitPriceFormat;

/**
 * The visual text of a number. Every visual minus is U+2212, en-US included, where Intl writes
 * U+002D, so negative values align and read the same in every locale.
 */
function visualNumber(locale: SupportedLocale, value: number, options: Intl.NumberFormatOptions): string {
  return numberFormat(locale, options)
    .formatToParts(value)
    .map((part) => (part.type === "minusSign" || part.type === "exponentMinusSign" ? "\u2212" : part.value))
    .join("");
}

/**
 * The spoken text of a number. Signs become words, because a speech engine may skip U+2212 and
 * read a negative price as a positive one.
 */
function spokenNumber(
  locale: SupportedLocale,
  words: ChartWords,
  value: number,
  options: Intl.NumberFormatOptions
): string {
  const { minus, plus, percent } = words.spokenSigns;
  return numberFormat(locale, options)
    .formatToParts(value)
    .map((part) => {
      switch (part.type) {
        case "minusSign":
        case "exponentMinusSign":
          return ` ${minus} `;
        case "plusSign":
          return ` ${plus} `;
        case "percentSign":
          return ` ${percent} `;
        default:
          return part.value;
      }
    })
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * The long display forms a speech engine reads more reliably than symbols. Intl ignores each one
 * outside its own style or notation.
 */
function spokenOptions(options: Intl.NumberFormatOptions): Intl.NumberFormatOptions {
  return { ...options, currencyDisplay: "name", unitDisplay: "long", compactDisplay: "long" };
}

/**
 * Fraction digits for a preset. A consumer minimum above the preset's default maximum raises the
 * maximum with it, where Intl would throw a RangeError on the pair.
 */
function digits(format: FractionDigits, defaultMaximum: number | undefined): FractionDigits {
  const { minimumFractionDigits, maximumFractionDigits } = format;
  return {
    minimumFractionDigits,
    maximumFractionDigits:
      maximumFractionDigits ??
      (defaultMaximum === undefined ? undefined : Math.max(defaultMaximum, minimumFractionDigits ?? 0)),
  };
}

function inflect(
  locale: SupportedLocale,
  value: number,
  fraction: FractionDigits,
  word: { readonly one: string; readonly other: string }
): string {
  return pluralRules(locale, fraction).select(value) === "one" ? word.one : word.other;
}

function formatPreset(
  locale: SupportedLocale,
  words: ChartWords,
  value: number,
  format: EnergyFormat | PowerFormat | UnitPriceFormat,
  role: LabelRole
): FormattedText {
  if (format.preset === "energy" || format.preset === "power") {
    const fraction = digits(format, 2);
    const options: Intl.NumberFormatOptions = { ...fraction, signDisplay: "negative" };
    return makeFormattedText(
      `${visualNumber(locale, value, options)} ${format.unit}`,
      `${spokenNumber(locale, words, value, options)} ${inflect(locale, value, fraction, words.unitNames[format.unit])}`
    );
  }
  const vat = role === "full" ? ` ${words.vat[format.vat]}` : "";
  const spokenVat = role === "full" ? ` ${words.spokenVat[format.vat]}` : "";
  if (format.minor === true) {
    const fraction = digits(format, 1);
    const options: Intl.NumberFormatOptions = { ...fraction, signDisplay: "negative" };
    const minorName = inflect(locale, value, fraction, words.minorName[format.currency]);
    return makeFormattedText(
      `${visualNumber(locale, value, options)} ${words.minorSymbol[format.currency]}/kWh${vat}`,
      `${spokenNumber(locale, words, value, options)} ${minorName} ${words.spokenPerKilowattHour}${spokenVat}`
    );
  }
  const options: Intl.NumberFormatOptions = {
    ...digits(format, undefined),
    style: "currency",
    currency: format.currency,
    signDisplay: "negative",
  };
  return makeFormattedText(
    `${visualNumber(locale, value, options)}/kWh${vat}`,
    `${spokenNumber(locale, words, value, spokenOptions(options))} ${words.spokenPerKilowattHour}${spokenVat}`
  );
}

/**
 * Format a chart value for one locale.
 *
 * Values that round to zero, and −0, print `0`, because `signDisplay` defaults to `"negative"`.
 * A `signDisplay` in Intl options wins over that default. Presets never take one.
 *
 * @param locale - The active supported locale.
 * @param value - The value, or `null` for a missing reading.
 * @param format - Intl number options or a preset.
 * @param role - `tick` leaves out the VAT basis of a unit price, and `full` writes it.
 * @returns The visual and spoken labels, with canonical spaces.
 */
export function formatValue(
  locale: SupportedLocale,
  value: number | null,
  format: ValueFormat,
  role: LabelRole
): FormattedText {
  const words = CHART_WORDS[locale];
  if (value === null) {
    return makeFormattedText(words.noValue.text, words.noValue.spoken);
  }
  if ("preset" in format) {
    return formatPreset(locale, words, value, format, role);
  }
  const options: Intl.NumberFormatOptions = { ...format, signDisplay: format.signDisplay ?? "negative" };
  return makeFormattedText(
    visualNumber(locale, value, options),
    spokenNumber(locale, words, value, spokenOptions(options))
  );
}
