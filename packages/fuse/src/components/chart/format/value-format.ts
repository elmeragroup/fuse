/**
 * Value labels for chart axes, tooltips, aria text and tables. A format is plain data, either Intl
 * number options or a named preset, so a server component can pass it to a client chart.
 */
import { numberFormat } from "../../../internal/intl-cache";
import { canonicalSpaces } from "../../../intl/canonical-spaces";
import { inflect } from "../../../intl/count-of";
import type { SupportedLocale } from "../../../intl/locale-context";
import { makeFormattedText } from "./formatted-text";
import type { FormattedText, LabelRole } from "./formatted-text";
import { CHART_WORDS } from "./words";
import type { ChartWords } from "./words";

/**
 * The fraction digits every preset accepts. It is exported because `ValueFormat` and
 * `ChartShareFormat` reference it.
 *
 * @beta
 */
export type ChartFractionDigits = {
  /** The fewest fraction digits to show. */
  readonly minimumFractionDigits?: number;
  /** The most fraction digits to show. */
  readonly maximumFractionDigits?: number;
};

/**
 * A value format, either Intl number options or one of Fuse's energy-market presets. It is plain
 * data, so a server component can pass it to a client chart, and a function fails the type. The
 * Intl arm carries `preset?: never`, so a preset object that lacks a required field cannot pass as
 * Intl options.
 *
 * - `energy` prints energy, such as `1 234,5 kWh`. The SI symbol is the same in every locale.
 * - `power` prints power, such as `3,2 kW`.
 * - `unit-price` prints a price per kilowatt-hour, such as `1,42 kr/kWh inkl. mva` or, with
 *   `minor`, `142,3 øre/kWh inkl. mva`. Full labels name the VAT basis, because Norwegian consumer
 *   law requires every price element to show. Fuse computes no VAT, so `vat` states the data's own
 *   basis.
 *
 * @beta
 */
export type ValueFormat =
  | (Intl.NumberFormatOptions & { readonly preset?: never })
  | (ChartFractionDigits & {
      /** Selects the energy preset. */
      readonly preset: "energy";
      /** The energy unit the value is in. */
      readonly unit: "Wh" | "kWh" | "MWh";
    })
  | (ChartFractionDigits & {
      /** Selects the power preset. */
      readonly preset: "power";
      /** The power unit the value is in. */
      readonly unit: "W" | "kW" | "MW";
    })
  | (ChartFractionDigits & {
      /** Selects the unit-price preset. */
      readonly preset: "unit-price";
      /** The currency the value is in. */
      readonly currency: "NOK" | "SEK" | "EUR";
      /** Whether the value is in the currency's subunit, such as øre or cents. */
      readonly minor?: boolean;
      /** Whether the value includes VAT. */
      readonly vat: "included" | "excluded";
    });

/** One of Fuse's presets. */
type PresetFormat = Exclude<ValueFormat, { readonly preset?: never }>;

/**
 * Whether Intl writes no minus sign for a value: one at or above zero, but not -0, in a notation
 * without an exponent, which can be negative.
 */
function unsigned(value: number, options: Intl.NumberFormatOptions): boolean {
  return (
    value >= 0 &&
    !Object.is(value, -0) &&
    options.notation !== "scientific" &&
    options.notation !== "engineering"
  );
}

/** Whether the options write a plus sign on a value above zero. */
function signed(options: Intl.NumberFormatOptions): boolean {
  return options.signDisplay === "always" || options.signDisplay === "exceptZero";
}

/**
 * A number's visual parts as Intl writes them, but every minus U+2212, en-US included, where Intl
 * writes U+002D, so negative values align and read the same in every locale.
 */
function visualParts(
  locale: SupportedLocale,
  value: number,
  options: Intl.NumberFormatOptions
): Intl.NumberFormatPart[] {
  return numberFormat(locale, options)
    .formatToParts(value)
    .map((part) =>
      part.type === "minusSign" || part.type === "exponentMinusSign" ? { ...part, value: "\u2212" } : part
    );
}

/** Parts joined into their text. */
function joined(parts: readonly Intl.NumberFormatPart[]): string {
  return parts.map((part) => part.value).join("");
}

/** The visual text of a number: its visual parts joined. */
function visualNumber(locale: SupportedLocale, value: number, options: Intl.NumberFormatOptions): string {
  // With no sign to replace, the parts join to Intl's own text.
  if (unsigned(value, options)) return numberFormat(locale, options).format(value);
  return joined(visualParts(locale, value, options));
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
  const format = numberFormat(locale, options);
  // With no sign and no percent sign to name, the parts join to Intl's own text.
  const text =
    unsigned(value, options) && !signed(options) && options.style !== "percent"
      ? format.format(value)
      : format
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
          .join("");
  return text.replace(/\s+/gu, " ").trim();
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
function digits(format: ChartFractionDigits, defaultMaximum: number | undefined): ChartFractionDigits {
  const { minimumFractionDigits, maximumFractionDigits } = format;
  return {
    minimumFractionDigits,
    maximumFractionDigits:
      maximumFractionDigits ??
      (defaultMaximum === undefined ? undefined : Math.max(defaultMaximum, minimumFractionDigits ?? 0)),
  };
}

/**
 * A preset's fraction digits: energy and power print up to 2, a minor unit price up to 1, and a
 * unit price in its currency the currency's own.
 */
function presetDigits(format: PresetFormat): ChartFractionDigits {
  if (format.preset !== "unit-price") return digits(format, 2);
  return digits(format, format.minor === true ? 1 : undefined);
}

/**
 * The Intl options a value's visual number prints with: a preset's digits and sign, the currency of
 * a unit price in kroner, or the consumer's Intl options with the negative-only sign by default.
 */
function visualOptions(format: ValueFormat): Intl.NumberFormatOptions {
  if (format.preset === undefined) return { ...format, signDisplay: format.signDisplay ?? "negative" };
  const fraction = presetDigits(format);
  if (format.preset === "unit-price" && format.minor !== true) {
    return { ...fraction, style: "currency", currency: format.currency, signDisplay: "negative" };
  }
  return { ...fraction, signDisplay: "negative" };
}

/**
 * A format's unit around a value's number: the Intl options the visual and the spoken number print
 * with, and the unit's text after the number in either form, such as ` kWh` and ` kilowattimer`.
 */
type ValueUnit = {
  readonly options: Intl.NumberFormatOptions;
  readonly spokenOptions: Intl.NumberFormatOptions;
  readonly after: string;
  readonly spokenAfter: string;
};

/**
 * A value's unit in a format.
 *
 * @param locale - The active supported locale.
 * @param words - The locale's chart words.
 * @param value - The value, which a unit's name inflects by.
 * @param format - Intl number options or a preset.
 * @param role - The label's role: a `full` unit price names its VAT basis.
 * @returns The unit.
 */
function valueUnit(
  locale: SupportedLocale,
  words: ChartWords,
  value: number,
  format: ValueFormat,
  role: LabelRole
): ValueUnit {
  const options = visualOptions(format);
  if (format.preset === undefined) {
    return { options, spokenOptions: spokenOptions(options), after: "", spokenAfter: "" };
  }
  const fraction = presetDigits(format);
  if (format.preset === "energy" || format.preset === "power") {
    const name = inflect(locale, value, words.unitNames[format.unit], fraction);
    return { options, spokenOptions: options, after: ` ${format.unit}`, spokenAfter: ` ${name}` };
  }
  const vat = role === "full" ? ` ${words.vat[format.vat]}` : "";
  const spokenVat = role === "full" ? ` ${words.spokenVat[format.vat]}` : "";
  if (format.minor === true) {
    const minorName = inflect(locale, value, words.minorName[format.currency], fraction);
    return {
      options,
      spokenOptions: options,
      after: ` ${words.minorSymbol[format.currency]}/kWh${vat}`,
      spokenAfter: ` ${minorName} ${words.spokenPerKilowattHour}${spokenVat}`,
    };
  }
  return {
    options,
    spokenOptions: spokenOptions(options),
    after: `/kWh${vat}`,
    spokenAfter: ` ${words.spokenPerKilowattHour}${spokenVat}`,
  };
}

/**
 * Whether two value formats name the same options, in any key order and with an option set to
 * undefined read as left out, so a format written either way prints as the same one and shares a
 * total with it.
 *
 * @param a - One format.
 * @param b - The other.
 * @returns Whether they match.
 */
export function sameFormat(a: ValueFormat, b: ValueFormat): boolean {
  if (a === b) return true;
  // An option set to undefined reads as one left out, as Intl and the formatters read it.
  const left = Object.entries(a).filter(([, value]) => value !== undefined);
  const right = new Map(Object.entries(b).filter(([, value]) => value !== undefined));
  return (
    left.length === right.size &&
    left.every(([key, value]) => right.has(key) && Object.is(value, right.get(key)))
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
  const unit = valueUnit(locale, words, value, format, role);
  return makeFormattedText(
    `${visualNumber(locale, value, unit.options)}${unit.after}`,
    `${spokenNumber(locale, words, value, unit.spokenOptions)}${unit.spokenAfter}`
  );
}

/**
 * A formatted value as its number and the text the formatter wrote around it, which a centre lays
 * out apart: the number large and rolling, the text before and after it small and breakable.
 */
export type ValueRun = {
  /** The text before the number, such as `NOK ` or `$`, with the separator the formatter wrote. */
  readonly before: string;
  /** The number, from its sign through its last digit, exponent or compact suffix. */
  readonly number: string;
  /** The text after the number, such as ` kWh` or ` øre/kWh inkl. mva`. */
  readonly after: string;
};

/** The Intl parts that belong to a number: its sign, digits, separators, exponent and compact suffix. */
const NUMBER_PARTS: ReadonlySet<string> = new Set([
  "minusSign",
  "plusSign",
  "integer",
  "group",
  "decimal",
  "fraction",
  "exponentSeparator",
  "exponentMinusSign",
  "exponentInteger",
  "compact",
  "infinity",
  "nan",
]);

/**
 * A number's visual parts split at the number, which Intl's own parts name, so a multiword unit such
 * as `øre/kWh inkl. mva` stays whole, an exponent such as `3.9E3` stays in the number, a sign stays
 * on it, and a compact suffix such as `1,2 mill.` stays with it, whatever the locale writes
 * between. The number runs back from Intl's last number part over number parts and the literals
 * between them, and stops at a currency or a unit, so `+NOK 3.90` keeps `+NOK ` before its number.
 */
function numberRun(parts: readonly Intl.NumberFormatPart[]): ValueRun {
  const last = parts.findLastIndex((part) => NUMBER_PARTS.has(part.type));
  let first = last;
  for (let index = last - 1; index >= 0; index -= 1) {
    const type = parts[index]?.type ?? "";
    if (!NUMBER_PARTS.has(type) && type !== "literal") break;
    if (NUMBER_PARTS.has(type)) first = index;
  }
  // Intl writes a number part for every number, NaN and the infinities included.
  if (last === -1) throw new Error(`Intl wrote no number part in "${joined(parts)}".`);
  return {
    before: joined(parts.slice(0, first)),
    number: joined(parts.slice(first, last + 1)),
    after: joined(parts.slice(last + 1)),
  };
}

/**
 * A formatted value with its run: `formatValue`'s labels, and the visual text split at its number.
 * The run's three pieces join to the visual text.
 */
export type FormattedRun = FormattedText & ValueRun;

/**
 * Format a value as `formatValue` does, and split its visual text at its number, so a centre lays
 * the number out large and the unit around it small. One formatting writes both.
 *
 * @param locale - The active supported locale.
 * @param value - The value.
 * @param format - Intl number options or a preset.
 * @param role - The label's role, as `formatValue` takes it.
 * @returns The visual and spoken labels, and the text before the number, the number, and the text
 *   after it, each with canonical spaces.
 */
export function formatValueRun(
  locale: SupportedLocale,
  value: number,
  format: ValueFormat,
  role: LabelRole
): FormattedRun {
  const words = CHART_WORDS[locale];
  const unit = valueUnit(locale, words, value, format, role);
  const run = numberRun(visualParts(locale, value, unit.options));
  const before = canonicalSpaces(run.before);
  const number = canonicalSpaces(run.number);
  const after = canonicalSpaces(`${run.after}${unit.after}`);
  return {
    before,
    number,
    after,
    text: `${before}${number}${after}`,
    spoken: canonicalSpaces(`${spokenNumber(locale, words, value, unit.spokenOptions)}${unit.spokenAfter}`),
  };
}

/**
 * The number options a unitless table cell prints with: a preset's digits, or Intl options with
 * their currency or unit dropped and the currency's fraction digits kept.
 */
function unitlessOptions(format: ValueFormat): Intl.NumberFormatOptions {
  if (format.preset === "energy" || format.preset === "power")
    return { ...presetDigits(format), signDisplay: "negative" };
  if (format.preset === "unit-price") {
    // Without its currency a major price keeps the currency's 2 digits.
    const fraction = format.minor === true ? presetDigits(format) : digits(format, 2);
    return {
      ...fraction,
      minimumFractionDigits:
        format.minor === true ? fraction.minimumFractionDigits : (fraction.minimumFractionDigits ?? 2),
      signDisplay: "negative",
    };
  }
  if (format.style !== "currency" && format.style !== "unit")
    return { ...format, signDisplay: format.signDisplay ?? "negative" };
  const {
    style: _style,
    currency: _currency,
    currencyDisplay: _display,
    unit: _unit,
    unitDisplay: _unitDisplay,
    ...rest
  } = format;
  if (format.style !== "currency") return { ...rest, signDisplay: format.signDisplay ?? "negative" };
  // Dropping the currency style drops its digits too, so the currency's digits fill whichever
  // bound the format leaves open, kept on the right side of the bound it sets.
  const currency = numberFormat("en-US", {
    style: "currency",
    currency: format.currency ?? "NOK",
  }).resolvedOptions();
  const maximum =
    rest.maximumFractionDigits ??
    Math.max(currency.maximumFractionDigits ?? 2, rest.minimumFractionDigits ?? 0);
  return {
    ...rest,
    minimumFractionDigits:
      rest.minimumFractionDigits ?? Math.min(currency.minimumFractionDigits ?? 2, maximum),
    maximumFractionDigits: maximum,
    signDisplay: format.signDisplay ?? "negative",
  };
}

/**
 * A value as a table cell prints it, the number without its unit, because the column header
 * carries the unit once. Private to the chart Table, after CONTRACT section 9.6, and to the
 * description, which states the unit once per series, after section 9.3.
 *
 * @param locale - The active supported locale.
 * @param value - The value.
 * @param format - The series' format.
 * @returns The visual and spoken number, with canonical spaces.
 */
export function formatUnitless(locale: SupportedLocale, value: number, format: ValueFormat): FormattedText {
  const options = unitlessOptions(format);
  return makeFormattedText(
    visualNumber(locale, value, options),
    spokenNumber(locale, CHART_WORDS[locale], value, options)
  );
}

/** The part of a formatted 2 that names a currency or a unit, such as `kr` or `kilowattimer`. */
function unitPart(locale: SupportedLocale, options: Intl.NumberFormatOptions): string {
  return numberFormat(locale, options)
    .formatToParts(2)
    .filter((part) => part.type === "currency" || part.type === "unit")
    .map((part) => part.value)
    .join("");
}

/**
 * The unit a table column header names after the series label, such as `kWh` or
 * `øre/kWh inkl. mva`, or null when the format carries none.
 *
 * @param locale - The active supported locale.
 * @param format - The series' format.
 * @returns The visual and spoken unit, or null.
 */
export function formatUnitLabel(locale: SupportedLocale, format: ValueFormat): FormattedText | null {
  const words = CHART_WORDS[locale];
  if (format.preset === "energy" || format.preset === "power") {
    return makeFormattedText(format.unit, words.unitNames[format.unit].other);
  }
  if (format.preset === "unit-price") {
    const vat = ` ${words.vat[format.vat]}`;
    const spokenVat = ` ${words.spokenVat[format.vat]}`;
    if (format.minor === true) {
      return makeFormattedText(
        `${words.minorSymbol[format.currency]}/kWh${vat}`,
        `${words.minorName[format.currency].other} ${words.spokenPerKilowattHour}${spokenVat}`
      );
    }
    const symbol = unitPart(locale, { style: "currency", currency: format.currency });
    const name = unitPart(locale, { style: "currency", currency: format.currency, currencyDisplay: "name" });
    return makeFormattedText(`${symbol}/kWh${vat}`, `${name} ${words.spokenPerKilowattHour}${spokenVat}`);
  }
  if (format.style === "currency" || format.style === "unit") {
    return makeFormattedText(unitPart(locale, format), unitPart(locale, spokenOptions(format)));
  }
  return null;
}
