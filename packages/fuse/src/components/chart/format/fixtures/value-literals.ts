/** Value labels and words written by hand, which `value-judges.ts` compares with Fuse's output. */
import type { SupportedLocale } from "../../../../intl/locale-context";
import type { LabelRole } from "../formatted-text";
import type { ValueFormat } from "../value-format";
import type { Currency, EnergyUnit, PowerUnit } from "../words";
import type { LiteralCase } from "./judgement";

/** A format and value with one literal per locale. */
export type PresetCase = LiteralCase & {
  readonly value: number | null;
  readonly format: ValueFormat;
  readonly role: LabelRole;
};

/**
 * Value literals written by hand from CLDR 48 `numbers` and `currencies` JSON. nb, sv and fi group
 * with U+00A0 and use a decimal comma. Their currency patterns put U+00A0 before the symbol, and
 * their percent pattern puts U+00A0 before `%`. en groups with a comma, puts the symbol first and
 * inserts U+00A0 after an alphabetic symbol such as `NOK`. Every visual minus is U+2212, and every
 * space is U+00A0 after canonical spacing.
 */
export const PRESET_CASES: readonly PresetCase[] = [
  {
    name: "plain number",
    value: 1234.5,
    format: {},
    role: "full",
    text: { "nb-NO": "1\u00a0234,5", "sv-SE": "1\u00a0234,5", "fi-FI": "1\u00a0234,5", "en-US": "1,234.5" },
    spoken: { "nb-NO": "1\u00a0234,5", "sv-SE": "1\u00a0234,5", "fi-FI": "1\u00a0234,5", "en-US": "1,234.5" },
  },
  {
    name: "negative plain number",
    value: -1234.5,
    format: {},
    role: "full",
    text: {
      "nb-NO": "\u22121\u00a0234,5",
      "sv-SE": "\u22121\u00a0234,5",
      "fi-FI": "\u22121\u00a0234,5",
      "en-US": "\u22121,234.5",
    },
    spoken: {
      "nb-NO": "minus\u00a01\u00a0234,5",
      "sv-SE": "minus\u00a01\u00a0234,5",
      "fi-FI": "miinus\u00a01\u00a0234,5",
      "en-US": "minus\u00a01,234.5",
    },
  },
  {
    name: "percent",
    value: 0.123,
    format: { style: "percent", maximumFractionDigits: 1 },
    role: "full",
    text: { "nb-NO": "12,3\u00a0%", "sv-SE": "12,3\u00a0%", "fi-FI": "12,3\u00a0%", "en-US": "12.3%" },
    spoken: {
      "nb-NO": "12,3\u00a0prosent",
      "sv-SE": "12,3\u00a0procent",
      "fi-FI": "12,3\u00a0prosenttia",
      "en-US": "12.3\u00a0percent",
    },
  },
  {
    name: "signed percent delta",
    value: 0.084,
    format: { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" },
    role: "full",
    text: { "nb-NO": "+8,4\u00a0%", "sv-SE": "+8,4\u00a0%", "fi-FI": "+8,4\u00a0%", "en-US": "+8.4%" },
    spoken: {
      "nb-NO": "pluss\u00a08,4\u00a0prosent",
      "sv-SE": "plus\u00a08,4\u00a0procent",
      "fi-FI": "plus\u00a08,4\u00a0prosenttia",
      "en-US": "plus\u00a08.4\u00a0percent",
    },
  },
  {
    name: "negative currency",
    value: -1234.5,
    format: { style: "currency", currency: "NOK" },
    role: "full",
    text: {
      "nb-NO": "\u22121\u00a0234,50\u00a0kr",
      "sv-SE": "\u22121\u00a0234,50\u00a0Nkr",
      "fi-FI": "\u22121\u00a0234,50\u00a0NOK",
      "en-US": "\u2212NOK\u00a01,234.50",
    },
    spoken: {
      "nb-NO": "minus\u00a01\u00a0234,50\u00a0norske\u00a0kroner",
      "sv-SE": "minus\u00a01\u00a0234,50\u00a0norska\u00a0kronor",
      "fi-FI": "miinus\u00a01\u00a0234,50\u00a0Norjan\u00a0kruunua",
      "en-US": "minus\u00a01,234.50\u00a0Norwegian\u00a0kroner",
    },
  },
  {
    name: "energy",
    value: 1234.5,
    format: { preset: "energy", unit: "kWh" },
    role: "full",
    text: {
      "nb-NO": "1\u00a0234,5\u00a0kWh",
      "sv-SE": "1\u00a0234,5\u00a0kWh",
      "fi-FI": "1\u00a0234,5\u00a0kWh",
      "en-US": "1,234.5\u00a0kWh",
    },
    spoken: {
      "nb-NO": "1\u00a0234,5\u00a0kilowattimer",
      "sv-SE": "1\u00a0234,5\u00a0kilowattimmar",
      "fi-FI": "1\u00a0234,5\u00a0kilowattituntia",
      "en-US": "1,234.5\u00a0kilowatt-hours",
    },
  },
  {
    name: "one megawatt-hour",
    value: 1,
    format: { preset: "energy", unit: "MWh" },
    role: "tick",
    text: { "nb-NO": "1\u00a0MWh", "sv-SE": "1\u00a0MWh", "fi-FI": "1\u00a0MWh", "en-US": "1\u00a0MWh" },
    spoken: {
      "nb-NO": "1\u00a0megawattime",
      "sv-SE": "1\u00a0megawattimme",
      "fi-FI": "1\u00a0megawattitunti",
      "en-US": "1\u00a0megawatt-hour",
    },
  },
  {
    name: "negative power with fixed digits",
    value: -3.2,
    format: { preset: "power", unit: "kW", minimumFractionDigits: 2 },
    role: "full",
    text: {
      "nb-NO": "\u22123,20\u00a0kW",
      "sv-SE": "\u22123,20\u00a0kW",
      "fi-FI": "\u22123,20\u00a0kW",
      "en-US": "\u22123.20\u00a0kW",
    },
    spoken: {
      "nb-NO": "minus\u00a03,20\u00a0kilowatt",
      "sv-SE": "minus\u00a03,20\u00a0kilowatt",
      "fi-FI": "miinus\u00a03,20\u00a0kilowattia",
      "en-US": "minus\u00a03.20\u00a0kilowatts",
    },
  },
  {
    name: "unit price including VAT",
    value: 1.42,
    format: { preset: "unit-price", currency: "NOK", vat: "included" },
    role: "full",
    text: {
      "nb-NO": "1,42\u00a0kr/kWh\u00a0inkl.\u00a0mva",
      "sv-SE": "1,42\u00a0Nkr/kWh\u00a0inkl.\u00a0moms",
      "fi-FI": "1,42\u00a0NOK/kWh\u00a0sis.\u00a0alv",
      "en-US": "NOK\u00a01.42/kWh\u00a0incl.\u00a0VAT",
    },
    spoken: {
      "nb-NO": "1,42\u00a0norske\u00a0kroner\u00a0per\u00a0kilowattime\u00a0inkludert\u00a0merverdiavgift",
      "sv-SE": "1,42\u00a0norska\u00a0kronor\u00a0per\u00a0kilowattimme\u00a0inklusive\u00a0moms",
      "fi-FI": "1,42\u00a0Norjan\u00a0kruunua\u00a0kilowattitunnilta\u00a0sisältää\u00a0arvonlisäveron",
      "en-US": "1.42\u00a0Norwegian\u00a0kroner\u00a0per\u00a0kilowatt-hour\u00a0including\u00a0VAT",
    },
  },
  {
    name: "negative unit price on a tick",
    value: -0.05,
    format: { preset: "unit-price", currency: "SEK", vat: "excluded" },
    role: "tick",
    text: {
      "nb-NO": "\u22120,05\u00a0SEK/kWh",
      "sv-SE": "\u22120,05\u00a0kr/kWh",
      "fi-FI": "\u22120,05\u00a0SEK/kWh",
      "en-US": "\u2212SEK\u00a00.05/kWh",
    },
    spoken: {
      "nb-NO": "minus\u00a00,05\u00a0svenske\u00a0kroner\u00a0per\u00a0kilowattime",
      "sv-SE": "minus\u00a00,05\u00a0svenska\u00a0kronor\u00a0per\u00a0kilowattimme",
      "fi-FI": "miinus\u00a00,05\u00a0Ruotsin\u00a0kruunua\u00a0kilowattitunnilta",
      "en-US": "minus\u00a00.05\u00a0Swedish\u00a0kronor\u00a0per\u00a0kilowatt-hour",
    },
  },
  {
    name: "minor unit price excluding VAT",
    value: 98.7,
    format: { preset: "unit-price", currency: "SEK", minor: true, vat: "excluded" },
    role: "full",
    text: {
      "nb-NO": "98,7\u00a0øre/kWh\u00a0eks.\u00a0mva",
      "sv-SE": "98,7\u00a0öre/kWh\u00a0exkl.\u00a0moms",
      "fi-FI": "98,7\u00a0äyri/kWh\u00a0alv\u00a00\u00a0%",
      "en-US": "98.7\u00a0öre/kWh\u00a0excl.\u00a0VAT",
    },
    spoken: {
      "nb-NO": "98,7\u00a0øre\u00a0per\u00a0kilowattime\u00a0eksklusive\u00a0merverdiavgift",
      "sv-SE": "98,7\u00a0öre\u00a0per\u00a0kilowattimme\u00a0exklusive\u00a0moms",
      "fi-FI": "98,7\u00a0äyriä\u00a0kilowattitunnilta\u00a0arvonlisävero\u00a00\u00a0prosenttia",
      "en-US": "98.7\u00a0öre\u00a0per\u00a0kilowatt-hour\u00a0excluding\u00a0VAT",
    },
  },
  {
    name: "negative minor euro price keeps its VAT basis",
    value: -1.5,
    format: { preset: "unit-price", currency: "EUR", minor: true, vat: "included" },
    role: "full",
    text: {
      "nb-NO": "\u22121,5\u00a0cent/kWh\u00a0inkl.\u00a0mva",
      "sv-SE": "\u22121,5\u00a0cent/kWh\u00a0inkl.\u00a0moms",
      "fi-FI": "\u22121,5\u00a0snt/kWh\u00a0sis.\u00a0alv",
      "en-US": "\u22121.5\u00a0c/kWh\u00a0incl.\u00a0VAT",
    },
    spoken: {
      "nb-NO": "minus\u00a01,5\u00a0cent\u00a0per\u00a0kilowattime\u00a0inkludert\u00a0merverdiavgift",
      "sv-SE": "minus\u00a01,5\u00a0cent\u00a0per\u00a0kilowattimme\u00a0inklusive\u00a0moms",
      "fi-FI": "miinus\u00a01,5\u00a0senttiä\u00a0kilowattitunnilta\u00a0sisältää\u00a0arvonlisäveron",
      "en-US": "minus\u00a01.5\u00a0cents\u00a0per\u00a0kilowatt-hour\u00a0including\u00a0VAT",
    },
  },
  {
    name: "energy keeps two fraction digits by default",
    value: 0.123456,
    format: { preset: "energy", unit: "kWh" },
    role: "tick",
    text: {
      "nb-NO": "0,12\u00a0kWh",
      "sv-SE": "0,12\u00a0kWh",
      "fi-FI": "0,12\u00a0kWh",
      "en-US": "0.12\u00a0kWh",
    },
    spoken: {
      "nb-NO": "0,12\u00a0kilowattimer",
      "sv-SE": "0,12\u00a0kilowattimmar",
      "fi-FI": "0,12\u00a0kilowattituntia",
      "en-US": "0.12\u00a0kilowatt-hours",
    },
  },
  {
    name: "a consumer maximum wins over the preset's",
    value: 1.23456,
    format: { preset: "power", unit: "kW", maximumFractionDigits: 3 },
    role: "tick",
    text: {
      "nb-NO": "1,235\u00a0kW",
      "sv-SE": "1,235\u00a0kW",
      "fi-FI": "1,235\u00a0kW",
      "en-US": "1.235\u00a0kW",
    },
    spoken: {
      "nb-NO": "1,235\u00a0kilowatt",
      "sv-SE": "1,235\u00a0kilowatt",
      "fi-FI": "1,235\u00a0kilowattia",
      "en-US": "1.235\u00a0kilowatts",
    },
  },
  {
    name: "whole kilowatt-hours",
    value: 1234.5,
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
    role: "tick",
    text: {
      "nb-NO": "1\u00a0235\u00a0kWh",
      "sv-SE": "1\u00a0235\u00a0kWh",
      "fi-FI": "1\u00a0235\u00a0kWh",
      "en-US": "1,235\u00a0kWh",
    },
    spoken: {
      "nb-NO": "1\u00a0235\u00a0kilowattimer",
      "sv-SE": "1\u00a0235\u00a0kilowattimmar",
      "fi-FI": "1\u00a0235\u00a0kilowattituntia",
      "en-US": "1,235\u00a0kilowatt-hours",
    },
  },
  {
    name: "a consumer minimum above the preset's maximum raises it",
    value: 98.7,
    format: { preset: "unit-price", currency: "NOK", minor: true, vat: "included", minimumFractionDigits: 3 },
    role: "tick",
    text: {
      "nb-NO": "98,700\u00a0øre/kWh",
      "sv-SE": "98,700\u00a0öre/kWh",
      "fi-FI": "98,700\u00a0äyri/kWh",
      "en-US": "98.700\u00a0øre/kWh",
    },
    spoken: {
      "nb-NO": "98,700\u00a0øre\u00a0per\u00a0kilowattime",
      "sv-SE": "98,700\u00a0öre\u00a0per\u00a0kilowattimme",
      "fi-FI": "98,700\u00a0äyriä\u00a0kilowattitunnilta",
      "en-US": "98.700\u00a0øre\u00a0per\u00a0kilowatt-hour",
    },
  },
  {
    // CLDR plurals: nb `one` is n = 1, so 1,00 is singular. sv, fi and en `one` need v = 0.
    name: "one with visible fraction digits",
    value: 1,
    format: { preset: "energy", unit: "kWh", minimumFractionDigits: 2 },
    role: "tick",
    text: {
      "nb-NO": "1,00\u00a0kWh",
      "sv-SE": "1,00\u00a0kWh",
      "fi-FI": "1,00\u00a0kWh",
      "en-US": "1.00\u00a0kWh",
    },
    spoken: {
      "nb-NO": "1,00\u00a0kilowattime",
      "sv-SE": "1,00\u00a0kilowattimmar",
      "fi-FI": "1,00\u00a0kilowattituntia",
      "en-US": "1.00\u00a0kilowatt-hours",
    },
  },
  {
    name: "a temperature in Intl units",
    value: -3.5,
    format: { style: "unit", unit: "celsius", maximumFractionDigits: 1 },
    role: "full",
    text: {
      "nb-NO": "\u22123,5\u00a0°C",
      "sv-SE": "\u22123,5\u00a0°C",
      "fi-FI": "\u22123,5\u00a0°C",
      "en-US": "\u22123.5°C",
    },
    spoken: {
      "nb-NO": "minus\u00a03,5\u00a0grader\u00a0celsius",
      "sv-SE": "minus\u00a03,5\u00a0grader\u00a0Celsius",
      "fi-FI": "miinus\u00a03,5\u00a0celsiusastetta",
      "en-US": "minus\u00a03.5\u00a0degrees\u00a0Celsius",
    },
  },
  {
    name: "compact notation",
    value: 2_400_000,
    format: { notation: "compact", maximumFractionDigits: 1 },
    role: "tick",
    text: { "nb-NO": "2,4\u00a0mill.", "sv-SE": "2,4\u00a0mn", "fi-FI": "2,4\u00a0milj.", "en-US": "2.4M" },
    spoken: {
      "nb-NO": "2,4\u00a0millioner",
      "sv-SE": "2,4\u00a0miljoner",
      "fi-FI": "2,4\u00a0miljoonaa",
      "en-US": "2.4\u00a0million",
    },
  },
  {
    name: "a negative exponent",
    value: 0.00012,
    format: { notation: "scientific" },
    role: "tick",
    text: {
      "nb-NO": "1,2E\u22124",
      "sv-SE": "1,2×10^\u22124",
      "fi-FI": "1,2E\u22124",
      "en-US": "1.2E\u22124",
    },
    spoken: {
      "nb-NO": "1,2E\u00a0minus\u00a04",
      "sv-SE": "1,2×10^\u00a0minus\u00a04",
      "fi-FI": "1,2E\u00a0miinus\u00a04",
      "en-US": "1.2E\u00a0minus\u00a04",
    },
  },
  {
    name: "a value that rounds to zero",
    value: -0.3,
    format: { maximumFractionDigits: 0 },
    role: "full",
    text: { "nb-NO": "0", "sv-SE": "0", "fi-FI": "0", "en-US": "0" },
    spoken: { "nb-NO": "0", "sv-SE": "0", "fi-FI": "0", "en-US": "0" },
  },
  {
    name: "a consumer signDisplay wins",
    value: -0.3,
    format: { maximumFractionDigits: 0, signDisplay: "auto" },
    role: "full",
    text: { "nb-NO": "\u22120", "sv-SE": "\u22120", "fi-FI": "\u22120", "en-US": "\u22120" },
    spoken: {
      "nb-NO": "minus\u00a00",
      "sv-SE": "minus\u00a00",
      "fi-FI": "miinus\u00a00",
      "en-US": "minus\u00a00",
    },
  },
  {
    name: "a missing value",
    value: null,
    format: { preset: "energy", unit: "kWh" },
    role: "full",
    text: { "nb-NO": "\u2013", "sv-SE": "\u2013", "fi-FI": "\u2013", "en-US": "\u2013" },
    spoken: {
      "nb-NO": "ingen\u00a0verdi",
      "sv-SE": "inget\u00a0värde",
      "fi-FI": "ei\u00a0arvoa",
      "en-US": "no\u00a0value",
    },
  },
];

type UnitWords = { readonly [U in EnergyUnit | PowerUnit]: readonly [string, string] };
type MinorWords = { readonly [C in Currency]: readonly [string, string, string] };

/**
 * Every spoken unit name in the singular and plural, and every currency subunit as its symbol and
 * its two spoken forms. These are the drafted words `TODO.md` lists for sign-off.
 */
export const WORDS = {
  "nb-NO": {
    units: {
      Wh: ["wattime", "wattimer"],
      kWh: ["kilowattime", "kilowattimer"],
      MWh: ["megawattime", "megawattimer"],
      W: ["watt", "watt"],
      kW: ["kilowatt", "kilowatt"],
      MW: ["megawatt", "megawatt"],
    },
    minor: { NOK: ["øre", "øre", "øre"], SEK: ["øre", "øre", "øre"], EUR: ["cent", "cent", "cent"] },
  },
  "sv-SE": {
    units: {
      Wh: ["wattimme", "wattimmar"],
      kWh: ["kilowattimme", "kilowattimmar"],
      MWh: ["megawattimme", "megawattimmar"],
      W: ["watt", "watt"],
      kW: ["kilowatt", "kilowatt"],
      MW: ["megawatt", "megawatt"],
    },
    minor: { NOK: ["öre", "öre", "öre"], SEK: ["öre", "öre", "öre"], EUR: ["cent", "cent", "cent"] },
  },
  "fi-FI": {
    units: {
      Wh: ["wattitunti", "wattituntia"],
      kWh: ["kilowattitunti", "kilowattituntia"],
      MWh: ["megawattitunti", "megawattituntia"],
      W: ["watti", "wattia"],
      kW: ["kilowatti", "kilowattia"],
      MW: ["megawatti", "megawattia"],
    },
    minor: {
      NOK: ["äyri", "äyri", "äyriä"],
      SEK: ["äyri", "äyri", "äyriä"],
      EUR: ["snt", "sentti", "senttiä"],
    },
  },
  "en-US": {
    units: {
      Wh: ["watt-hour", "watt-hours"],
      kWh: ["kilowatt-hour", "kilowatt-hours"],
      MWh: ["megawatt-hour", "megawatt-hours"],
      W: ["watt", "watts"],
      kW: ["kilowatt", "kilowatts"],
      MW: ["megawatt", "megawatts"],
    },
    minor: { NOK: ["øre", "øre", "øre"], SEK: ["öre", "öre", "öre"], EUR: ["c", "cent", "cents"] },
  },
} as const satisfies {
  readonly [L in SupportedLocale]: { readonly units: UnitWords; readonly minor: MinorWords };
};

/** The spoken "per kilowatt-hour" that follows a spoken subunit price. */
export const SPOKEN_PER_KWH = {
  "nb-NO": "per\u00a0kilowattime",
  "sv-SE": "per\u00a0kilowattimme",
  "fi-FI": "kilowattitunnilta",
  "en-US": "per\u00a0kilowatt-hour",
} as const satisfies { readonly [L in SupportedLocale]: string };
