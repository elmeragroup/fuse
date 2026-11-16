import type { CountryCode, MetadataJson, PhoneNumber } from "libphonenumber-js/core";
import {
  AsYouType,
  getCountries as getMetadataCountries,
  getCountryCallingCode,
} from "libphonenumber-js/core";
import defaultMetadata from "libphonenumber-js/metadata.min.json";

import { flagAssets } from "../../flags";
import type { FlagAssetCode } from "../../flags";

/** The product and compliance exclusions, copied from the reference. */
const PRODUCT_EXCLUDED_COUNTRY_CODES = new Set<CountryCode>([
  "AF",
  "BY",
  "MM",
  "BI",
  "CF",
  "CD",
  "GN",
  "GW",
  "HT",
  "IQ",
  "IR",
  "LB",
  "LY",
  "ML",
  "MD",
  "NI",
  "NE",
  "KP",
  "RU",
  "SO",
  "SD",
  "SS",
  "SY",
  "TN",
  "UA",
  "VE",
  "YE",
  "ZW",
]);

// The four libphonenumber@1.13.13 codes with no packaged flag SVG, AC, BQ, EH and TA, are not
// listed here: `isPhoneCountryCode` filters on the flag manifest itself, so a fifth code
// appearing upstream needs no edit. The picker suites assert their absence from an
// independent list in test/phone-picker-contract.ts.

const DEFAULT_COUNTRY_CODE = "NO";

const INTERNATIONAL_PREFIX = "+";

const ITU_INTERNATIONAL_PREFIX = "00";

const PHONE_CHAR_REGEX = /[^\d\s+\-()]/g;

const LEADING_SEPARATORS_REGEX = /^[^\d+]+/;

const E164_NOISE_REGEX = /[^\d+]/g;

const NON_DIGIT_REGEX = /\D/g;

const EMPTY_PICKER_ERROR =
  "PhoneNumberField: no picker countries remain after intersecting libphonenumber metadata with packaged flag assets, the product exclusion set and the countries prop.";

export type PhoneCountryCode = Extract<CountryCode, FlagAssetCode>;

export type PhoneNumberCountry = {
  code: PhoneCountryCode;
  dialCode: string;
};

export type PhoneNumberFormat = "e164" | "international" | "national" | "raw";

// SAFETY: the pinned min metadata JSON is the MetadataJson document libphonenumber-js ships.
const metadataJson: MetadataJson = defaultMetadata;

function isPhoneCountryCode(code: string): code is PhoneCountryCode {
  return Object.hasOwn(flagAssets, code);
}

function createCountry(country: PhoneCountryCode, metadata: MetadataJson = metadataJson): PhoneNumberCountry {
  return {
    code: country,
    dialCode: `+${getCountryCallingCode(country, metadata)}`,
  };
}

/**
 * The picker countries: the catalog's, in its order, less the product exclusions and the
 * codes without a packaged flag, and, given an allow list, only the ones it names.
 */
export function getCountries(
  metadata: MetadataJson = metadataJson,
  allowed?: readonly string[]
): PhoneNumberCountry[] {
  return getMetadataCountries(metadata).reduce<PhoneNumberCountry[]>((acc, country) => {
    if (
      PRODUCT_EXCLUDED_COUNTRY_CODES.has(country) ||
      !isPhoneCountryCode(country) ||
      (allowed !== undefined && !allowed.includes(country))
    ) {
      return acc;
    }
    acc.push(createCountry(country, metadata));
    return acc;
  }, []);
}

export function requirePickerCountries(countries: PhoneNumberCountry[]): PhoneNumberCountry[] {
  if (countries.length === 0) {
    throw new Error(EMPTY_PICKER_ERROR);
  }
  return countries;
}

export function resolveSelectedCountry(
  countries: PhoneNumberCountry[],
  defaultCountryCode: CountryCode | undefined
): PhoneNumberCountry {
  const requested = defaultCountryCode
    ? countries.find((country) => country.code === defaultCountryCode)
    : undefined;
  if (requested) {
    return requested;
  }
  const norway = countries.find((country) => country.code === DEFAULT_COUNTRY_CODE);
  if (norway) {
    return norway;
  }
  const first = countries[0];
  if (!first) {
    throw new Error(EMPTY_PICKER_ERROR);
  }
  return first;
}

type ParsedPhoneInput = {
  readonly phoneNumber: PhoneNumber | undefined;
  /** What `AsYouType#input` returned: the entry formatted as far as its digits allow. */
  readonly formatted: string;
};

/** An input and the default country to parse it in, as {@link PhoneParser.parse} takes them. */
export type ParseRead = {
  /** A cleaned entry, or a national number behind its calling code. */
  readonly input: string;
  /** The default country, which libphonenumber ignores for a `+` number. */
  readonly country: CountryCode | undefined;
};

/** One libphonenumber parse. Callers read both results from it rather than parse twice. */
function parsePhoneInput({ input, country }: ParseRead, metadata: MetadataJson): ParsedPhoneInput {
  const asYouType = new AsYouType(country, metadata);
  const formatted = asYouType.input(input);
  return { phoneNumber: asYouType.getNumber(), formatted };
}

/**
 * The parses one editor state needs, kept on the state itself, as {@link PhoneParser.pin} returns
 * them. The map's values are the parse objects themselves, so no eviction from the memo can lose
 * them.
 */
export type ParsePins = ReadonlyMap<string, ParsedPhoneInput>;

/**
 * The parser a field uses under one catalog, with a memo of its parses. Every read of a number
 * calls it. When any read, transition or render reads an input again in the same default country,
 * it reuses the parse while the memo keeps it.
 */
export type PhoneParser = {
  /** The catalog every parse uses. */
  readonly metadata: MetadataJson;
  /**
   * Returns the parse of `read`.
   *
   * @param read - A non-empty input and its default country.
   * @returns The number the input parses to, if any, and its as-you-type output.
   */
  readonly parse: (read: ParseRead) => ParsedPhoneInput;
  /**
   * Returns the parses of `reads` that this parser has made and still keeps, for a state to keep
   * as its pins. It parses nothing. A read this parser never parsed under its catalog has nothing to pin,
   * and its first parse is a new one.
   *
   * @param reads - The reads a state needs.
   * @returns The kept parses of those reads.
   */
  readonly pin: (reads: Iterable<ParseRead>) => ParsePins;
  /**
   * Makes the parser look up `pins` before its recent parses until the next call, whatever else it
   * parses meanwhile. A transition calls it with the pins of the state it starts from.
   *
   * @param pins - The pins of the state a transition starts from, made by this parser.
   */
  readonly restore: (pins: ParsePins) => void;
};

/**
 * The most parses a {@link PhoneParser} keeps beyond the pinned ones. A transition parses at most
 * a few inputs, and a read that finds its parse among the recent ones moves it to the back. So a
 * parse that one transition reads is still kept when the same transition reads it again, and an
 * editor that sees thousands of keystrokes keeps sixteen. The state a later transition starts
 * from pins the parses that transition needs.
 */
const PARSE_MEMO_SIZE = 16;

/**
 * The run of digits at an input's start, after any `+`, with the separators among them that
 * libphonenumber's as-you-type reader skips. They are the characters of its `VALID_PUNCTUATION`
 * that `cleanPhoneInput` keeps: the space, the no-break and ideographic spaces, dashes and round
 * brackets. The reader reads the `+` and the digits up to the first character it does not skip.
 * So whatever follows the run, such as a tab, a newline or a second `+`, can end the number it
 * reads.
 */
const SKIPPED_RUN_REGEX = /^[\d \u00A0\u3000\-()]*/;

/**
 * The memo key of an input. The key is the input's `+`, then the digits of its leading run without
 * the separators the reader skips there, then the rest exactly as given. Two inputs with the same
 * key have the same `+`, the same digits before the rest, and the same rest, so libphonenumber
 * reads them alike. A tab or newline that ends one number gives it a key apart from the same
 * digits without one. libphonenumber takes a `+` number's country from its calling code and parses
 * it the same in every default country, so its key leaves the country out. It reads the digits of
 * any other input in the default country, so their key includes that country.
 */
function parseKey({ input, country }: ParseRead): string {
  const international = hasInternationalDigits(input);
  const body = international ? input.slice(INTERNATIONAL_PREFIX.length) : input;
  const run = SKIPPED_RUN_REGEX.exec(body)?.[0] ?? "";
  const key = toNationalDigits(run) + body.slice(run.length);
  return international ? INTERNATIONAL_PREFIX + key : `${country ?? ""}:${key}`;
}

/**
 * Creates a parser for one catalog, with its own memo. `parsePhoneInput` is pure, so a kept parse
 * equals a new parse of the same read. The memo changes how often libphonenumber runs, never what
 * a read returns. Each editor's configuration has its own parser and keeps it while the catalog
 * stays the same. A new catalog gets a new parser, so no parse outlives the metadata it came from.
 * Editors share no parser, so each editor's parse count depends on its own history alone.
 *
 * @param metadata - The catalog to parse with.
 * @returns A parser with an empty memo.
 */
export function createPhoneParser(metadata: MetadataJson): PhoneParser {
  // A Map iterates in insertion order, so moving each read parse to the back leaves the least
  // recently read one first, where eviction finds it. Pinned parses come from a state's pins, in a
  // separate map that eviction never touches.
  const recent = new Map<string, ParsedPhoneInput>();
  let pinned: ParsePins = new Map();
  return {
    metadata,
    parse(read) {
      const key = parseKey(read);
      const kept = pinned.get(key);
      if (kept) return kept;
      const parsed = recent.get(key) ?? parsePhoneInput(read, metadata);
      recent.delete(key);
      recent.set(key, parsed);
      if (recent.size > PARSE_MEMO_SIZE) {
        const oldest = recent.keys().next();
        if (!oldest.done) recent.delete(oldest.value);
      }
      return parsed;
    },
    pin(reads) {
      const pins = new Map<string, ParsedPhoneInput>();
      for (const read of reads) {
        const key = parseKey(read);
        const parsed = pinned.get(key) ?? recent.get(key);
        if (parsed) pins.set(key, parsed);
      }
      return pins;
    },
    restore(pins) {
      pinned = pins;
    },
  };
}

/**
 * Whether the digits start with their own `+` prefix, which gives them an identity independent of
 * the picker country.
 */
function hasInternationalDigits(digits: string): boolean {
  return digits.startsWith(INTERNATIONAL_PREFIX);
}

/**
 * The `+` and digits of a phone number as written, without its spacing, dashes and brackets.
 *
 * @param digits - The number as written.
 * @returns Its `+` and digits alone.
 */
export function toE164Digits(digits: string): string {
  return digits.replace(E164_NOISE_REGEX, "");
}

/** National digits without the separators `cleanPhoneInput` lets through. */
function toNationalDigits(digits: string): string {
  return digits.replace(NON_DIGIT_REGEX, "");
}

function getInternationalPrefix(countryCode: CountryCode | undefined, metadata: MetadataJson): string {
  if (!countryCode) {
    return "";
  }
  try {
    return `+${getCountryCallingCode(countryCode, metadata)}`;
  } catch {
    return "";
  }
}

function formatOutputValue(
  phoneNumber: PhoneNumber | undefined,
  digits: string,
  outputFormat: PhoneNumberFormat
): string {
  if (!phoneNumber) {
    if (outputFormat === "raw") return digits;
    return outputFormat === "e164" && hasInternationalDigits(digits) ? toE164Digits(digits) : "";
  }
  switch (outputFormat) {
    case "e164":
      return phoneNumber.number || "";
    case "international":
      return phoneNumber.formatInternational() || "";
    case "national":
      return phoneNumber.formatNational() || "";
    case "raw":
    default:
      return digits;
  }
}

/**
 * The two display switches, passed as one object so the call site cannot transpose them.
 */
type PhoneDisplayOptions = {
  international: boolean;
  formatOnType: boolean;
};

function getDisplayValue(
  { phoneNumber, formatted }: ParsedPhoneInput,
  { digits, parsedNational }: Pick<ProcessedPhoneInput, "digits" | "parsedNational">,
  country: CountryCode | undefined,
  { international, formatOnType }: PhoneDisplayOptions
): string {
  if (!digits) {
    return "";
  }
  if (hasInternationalDigits(digits) && (!phoneNumber?.country || phoneNumber.country !== country)) {
    return formatOnType && phoneNumber ? phoneNumber.formatInternational() : toE164Digits(digits);
  }
  if (!hasInternationalDigits(digits) && !international && !parsedNational) {
    // A national draft displays as entered, trunk prefix included: libphonenumber leaves the
    // trunk 0 of "0701" out of the parsed number and its national formats ("701"), while its
    // as-you-type output keeps it ("070-1"). The digits fallback is defensive: `cleanPhoneInput`
    // leaves no entry that output is empty for.
    return (formatOnType && formatted) || toNationalDigits(digits);
  }
  if (formatOnType && phoneNumber) {
    if (international) {
      return phoneNumber.formatInternational() || digits;
    }
    return phoneNumber.formatNational() || digits;
  }
  if (!international && phoneNumber && country) {
    return phoneNumber.nationalNumber || digits;
  }
  return digits;
}

/**
 * Keeps the characters a phone number is written with, and drops separators before its first
 * digit or `+`, so a copied " +46 70…" or "(+46) 70…" still reads as international.
 */
export function cleanPhoneInput(input: string): string {
  return input.replace(PHONE_CHAR_REGEX, "").replace(LEADING_SEPARATORS_REGEX, "");
}

/** Whether cleaned input starts with a `+` or `00` international prefix, and so names a calling code. */
export function hasInternationalPrefix(input: string): boolean {
  return hasInternationalDigits(input) || input.startsWith(ITU_INTERNATIONAL_PREFIX);
}

function normalizeInternationalPrefix(input: string): string {
  if (input.startsWith(ITU_INTERNATIONAL_PREFIX)) {
    return INTERNATIONAL_PREFIX + input.substring(ITU_INTERNATIONAL_PREFIX.length);
  }
  return input;
}

/**
 * The number a cleaned entry with its own `+` or `00` prefix parses to. libphonenumber reads it by
 * its calling code alone, so the number is the same in every country, and its country is the one
 * the prefix detects.
 *
 * @param input - A cleaned entry.
 * @param parser - The parser of the field's catalog.
 * @returns The number, or `undefined` without a prefix or when the input forms no number, such as `"+10"`.
 */
export function internationalNumber(input: string, parser: PhoneParser): PhoneNumber | undefined {
  if (!hasInternationalPrefix(input)) {
    return undefined;
  }
  return parser.parse({ input: normalizeInternationalPrefix(input), country: undefined }).phoneNumber;
}

export type ProcessedPhoneInput = {
  digits: string;
  country: PhoneNumberCountry;
  /**
   * Whether the digits are the national number libphonenumber parsed from an international entry,
   * not what the user typed. They carry no trunk prefix, so they display as that national number, in
   * the national format under `formatOnType`, rather than as typed.
   */
  parsedNational?: boolean;
};

/** Options for {@link processInputWithDetection}. */
type ProcessInputOptions = {
  input: string;
  currentCountry: PhoneNumberCountry;
  countries: readonly PhoneNumberCountry[];
  autoDetectCountry: boolean;
  international: boolean;
  parser: PhoneParser;
};

export function processInputWithDetection({
  input,
  currentCountry,
  countries,
  autoDetectCountry,
  international,
  parser,
}: ProcessInputOptions): ProcessedPhoneInput {
  if (!hasInternationalPrefix(input)) {
    return { digits: input, country: currentCountry };
  }

  const normalized = normalizeInternationalPrefix(input);
  if (!autoDetectCountry) return { digits: normalized, country: currentCountry };
  // The parse that detects the country gives the same number in every default country, so its
  // national number matches a read in the detected country.
  const number = internationalNumber(normalized, parser);
  const detected = number?.country;
  const nextCountry = detected ? countries.find((row) => row.code === detected) : undefined;
  const country = nextCountry && nextCountry.code !== currentCountry.code ? nextCountry : currentCountry;

  if (!international && nextCountry && number) {
    return { digits: number.nationalNumber, country, parsedNational: true };
  }

  return { digits: normalized, country };
}

/**
 * The read that {@link resolvePhoneFieldValues} parses for a snapshot's values. Detected digits
 * are already a national number, so the read puts them behind their calling code. Any other
 * digits go in as they stand.
 *
 * The original international input and this read can differ after detection strips a trunk
 * prefix. libphonenumber strips a trunk prefix once per parse, so `"+4600701234567"` keeps a `0`
 * that `"+460701234567"` loses. The different input needs another parse unless the parser already
 * keeps it.
 *
 * @param digits - The snapshot's digits.
 * @param parsedNational - Whether detection made them a national number.
 * @param country - The country to read them in, which is the read's default country.
 * @param metadata - The catalog, for the calling code.
 * @returns The input and its default country.
 */
export function valuesRead(
  digits: string,
  parsedNational: boolean | undefined,
  country: CountryCode | undefined,
  metadata: MetadataJson
): ParseRead {
  return { input: parsedNational ? getInternationalPrefix(country, metadata) + digits : digits, country };
}

/** What a snapshot shows and submits. */
export type PhoneFieldValues = {
  displayValue: string;
  outputValue: string;
  /**
   * The E.164 number the digits parse to, once they make one; the number's identity. A later read
   * under another catalog takes it as the number entered under this one.
   */
  number: string | undefined;
};

/** Options for {@link resolvePhoneFieldValues}. */
type ResolvePhoneFieldValuesOptions = {
  digits: string;
  parsedNational?: boolean;
  country: CountryCode | undefined;
  parser: PhoneParser;
  outputFormat: PhoneNumberFormat;
  international: boolean;
  formatOnType: boolean;
};

export function resolvePhoneFieldValues({
  digits,
  parsedNational,
  country,
  parser,
  outputFormat,
  international,
  formatOnType,
}: ResolvePhoneFieldValuesOptions): PhoneFieldValues {
  if (!digits) {
    return { displayValue: "", outputValue: "", number: undefined };
  }
  // A national draft parses as a national entry, with the country as its default. The
  // as-you-type output then keeps a typed trunk prefix for the display ("070-1", where behind
  // the calling code it reads "+46 070 1"), and every country's trunk prefix stays out of the
  // number: behind the calling code, Kazakhstan's 8 or Uruguay's 0 was read as part of it.
  // A typed draft at a local number's length takes local-dialing rules: with Anguilla
  // selected, "2351234" submits as +12642351234, and a typed ten-digit number passes through
  // such a value at its seventh key. Detected digits are already a national number, so they
  // parse behind the calling code again, where a partial one takes no such rule.
  const parsed = parser.parse(valuesRead(digits, parsedNational, country, parser.metadata));
  return {
    displayValue: getDisplayValue(parsed, { digits, parsedNational }, country, {
      international,
      formatOnType,
    }),
    outputValue: formatOutputValue(parsed.phoneNumber, digits, outputFormat),
    number: parsed.phoneNumber?.number,
  };
}

export { metadataJson as defaultMetadata };
