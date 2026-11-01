import type { SupportedLocale } from "../../../intl/locale-context";
/**
 * Fuse's four-locale chart words. Intl has no currency subunits, no VAT basis, no week-number field
 * and no spoken forms, so Fuse owns these strings like its other built-in strings. Every entry is a
 * draft until the content owner signs it off. A space in an entry may be any space
 * character, because every formatter maps its output through `canonicalSpaces`.
 */
import type { Inflected } from "./inflection";
import type { ValueFormat } from "./value-format";

/** The currencies a unit price can carry. */
export type Currency = Extract<ValueFormat, { readonly preset: "unit-price" }>["currency"];

/** The energy units the `energy` preset writes. Intl sanctions none of them. */
export type EnergyUnit = Extract<ValueFormat, { readonly preset: "energy" }>["unit"];

/** The power units the `power` preset writes. Intl sanctions none of them. */
export type PowerUnit = Extract<ValueFormat, { readonly preset: "power" }>["unit"];

/** Whether a unit price includes VAT. */
export type VatBasis = Extract<ValueFormat, { readonly preset: "unit-price" }>["vat"];

/** The words one locale needs. */
export type ChartWords = {
  /** The locale's clock. `h23` locales write `00` to `24`, and `h12` locales write `12 AM` to `11 PM`. */
  readonly clock: "h23" | "h12";
  /** The visual range separator between two clock times, from CLDR's interval format. */
  readonly rangeSeparator: string;
  /**
   * A slot finer than a day on a domain of more than one date, its date leading its own label,
   * such as `onsdag 1. oktober, kl. 00 til 01`. A drafted word that `TODO.md` lists for sign-off.
   */
  readonly slotOnDate: (date: string, slot: string) => string;
  /** The spoken form of one clock time, such as `kl. 14`. */
  readonly spokenTime: (time: string) => string;
  /** The spoken form of a range of clock times, such as `kl. 14 til 15`. */
  readonly spokenRange: (start: string, end: string) => string;
  /** The visual ISO 8601 week label. */
  readonly week: (week: number) => string;
  /** The spoken ISO 8601 week label. */
  readonly spokenWeek: (week: number) => string;
  /** The words spoken in place of the minus sign, plus sign and percent sign. */
  readonly spokenSigns: { readonly minus: string; readonly plus: string; readonly percent: string };
  /** The text and spoken text of a missing value. */
  readonly noValue: { readonly text: string; readonly spoken: string };
  /** The spoken names of the energy and power units. */
  readonly unitNames: { readonly [U in EnergyUnit | PowerUnit]: Inflected };
  /** The visual subunit of each currency, such as `øre`. */
  readonly minorSymbol: { readonly [C in Currency]: string };
  /** The spoken subunit of each currency. */
  readonly minorName: { readonly [C in Currency]: Inflected };
  /** The spoken "per kilowatt-hour" that follows a spoken price. */
  readonly spokenPerKilowattHour: string;
  /** The visual VAT basis that follows a full unit price. */
  readonly vat: { readonly [B in VatBasis]: string };
  /** The spoken VAT basis that follows a spoken unit price. */
  readonly spokenVat: { readonly [B in VatBasis]: string };
};

const same = (word: string): Inflected => ({ one: word, other: word });

const NB_NO: ChartWords = {
  clock: "h23",
  rangeSeparator: "\u2013",
  slotOnDate: (date, slot) => `${date}, ${slot}`,
  spokenTime: (time) => `kl. ${time}`,
  spokenRange: (start, end) => `kl. ${start} til ${end}`,
  week: (week) => `uke ${String(week)}`,
  spokenWeek: (week) => `uke ${String(week)}`,
  spokenSigns: { minus: "minus", plus: "pluss", percent: "prosent" },
  noValue: { text: "\u2013", spoken: "ingen verdi" },
  unitNames: {
    Wh: { one: "wattime", other: "wattimer" },
    kWh: { one: "kilowattime", other: "kilowattimer" },
    MWh: { one: "megawattime", other: "megawattimer" },
    W: same("watt"),
    kW: same("kilowatt"),
    MW: same("megawatt"),
  },
  minorSymbol: { NOK: "øre", SEK: "øre", EUR: "cent" },
  minorName: { NOK: same("øre"), SEK: same("øre"), EUR: same("cent") },
  spokenPerKilowattHour: "per kilowattime",
  vat: { included: "inkl. mva", excluded: "eks. mva" },
  spokenVat: { included: "inkludert merverdiavgift", excluded: "eksklusive merverdiavgift" },
};

const SV_SE: ChartWords = {
  clock: "h23",
  rangeSeparator: "\u2013",
  slotOnDate: (date, slot) => `${date}, ${slot}`,
  spokenTime: (time) => `kl. ${time}`,
  spokenRange: (start, end) => `kl. ${start} till ${end}`,
  week: (week) => `v. ${String(week)}`,
  spokenWeek: (week) => `vecka ${String(week)}`,
  spokenSigns: { minus: "minus", plus: "plus", percent: "procent" },
  noValue: { text: "\u2013", spoken: "inget värde" },
  unitNames: {
    Wh: { one: "wattimme", other: "wattimmar" },
    kWh: { one: "kilowattimme", other: "kilowattimmar" },
    MWh: { one: "megawattimme", other: "megawattimmar" },
    W: same("watt"),
    kW: same("kilowatt"),
    MW: same("megawatt"),
  },
  minorSymbol: { NOK: "öre", SEK: "öre", EUR: "cent" },
  minorName: { NOK: same("öre"), SEK: same("öre"), EUR: same("cent") },
  spokenPerKilowattHour: "per kilowattimme",
  vat: { included: "inkl. moms", excluded: "exkl. moms" },
  spokenVat: { included: "inklusive moms", excluded: "exklusive moms" },
};

const FI_FI: ChartWords = {
  clock: "h23",
  rangeSeparator: "\u2013",
  slotOnDate: (date, slot) => `${date}, ${slot}`,
  spokenTime: (time) => `klo ${time}`,
  spokenRange: (start, end) => `klo ${start} ja ${end} välillä`,
  week: (week) => `vko ${String(week)}`,
  spokenWeek: (week) => `viikko ${String(week)}`,
  spokenSigns: { minus: "miinus", plus: "plus", percent: "prosenttia" },
  noValue: { text: "\u2013", spoken: "ei arvoa" },
  unitNames: {
    Wh: { one: "wattitunti", other: "wattituntia" },
    kWh: { one: "kilowattitunti", other: "kilowattituntia" },
    MWh: { one: "megawattitunti", other: "megawattituntia" },
    W: { one: "watti", other: "wattia" },
    kW: { one: "kilowatti", other: "kilowattia" },
    MW: { one: "megawatti", other: "megawattia" },
  },
  minorSymbol: { NOK: "äyri", SEK: "äyri", EUR: "snt" },
  minorName: {
    NOK: { one: "äyri", other: "äyriä" },
    SEK: { one: "äyri", other: "äyriä" },
    EUR: { one: "sentti", other: "senttiä" },
  },
  spokenPerKilowattHour: "kilowattitunnilta",
  vat: { included: "sis. alv", excluded: "alv 0 %" },
  spokenVat: { included: "sisältää arvonlisäveron", excluded: "arvonlisävero 0 prosenttia" },
};

const EN_US: ChartWords = {
  clock: "h12",
  rangeSeparator: "\u2009\u2013\u2009",
  slotOnDate: (date, slot) => `${date}, ${slot}`,
  spokenTime: (time) => time,
  spokenRange: (start, end) => `${start} to ${end}`,
  week: (week) => `W${String(week)}`,
  spokenWeek: (week) => `week ${String(week)}`,
  spokenSigns: { minus: "minus", plus: "plus", percent: "percent" },
  noValue: { text: "\u2013", spoken: "no value" },
  unitNames: {
    Wh: { one: "watt-hour", other: "watt-hours" },
    kWh: { one: "kilowatt-hour", other: "kilowatt-hours" },
    MWh: { one: "megawatt-hour", other: "megawatt-hours" },
    W: { one: "watt", other: "watts" },
    kW: { one: "kilowatt", other: "kilowatts" },
    MW: { one: "megawatt", other: "megawatts" },
  },
  minorSymbol: { NOK: "øre", SEK: "öre", EUR: "c" },
  minorName: { NOK: same("øre"), SEK: same("öre"), EUR: { one: "cent", other: "cents" } },
  spokenPerKilowattHour: "per kilowatt-hour",
  vat: { included: "incl. VAT", excluded: "excl. VAT" },
  spokenVat: { included: "including VAT", excluded: "excluding VAT" },
};

/** The chart words of every supported locale. */
export const CHART_WORDS = {
  "nb-NO": NB_NO,
  "sv-SE": SV_SE,
  "fi-FI": FI_FI,
  "en-US": EN_US,
} as const satisfies { readonly [L in SupportedLocale]: ChartWords };
