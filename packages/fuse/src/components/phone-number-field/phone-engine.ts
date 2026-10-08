import type { CountryCode, MetadataJson, PhoneNumber } from "libphonenumber-js/core";
import {
  AsYouType,
  getCountries as getMetadataCountries,
  getCountryCallingCode,
} from "libphonenumber-js/core";
import defaultMetadata from "libphonenumber-js/metadata.min.json";

import { flagAssets } from "../../flags";
import type { FlagAssetCode } from "../../flags";

/** Product/compliance exclusion copied from the reference. */
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

// The four libphonenumber@1.13.13 codes with no packaged flag SVG — AC, BQ, EH, TA — are not
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
  "PhoneNumberField: no picker countries remain after intersecting libphonenumber metadata with packaged flag assets and the product exclusion set.";

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

export function getCountries(metadata: MetadataJson = metadataJson): PhoneNumberCountry[] {
  return getMetadataCountries(metadata).reduce<PhoneNumberCountry[]>((acc, country) => {
    if (PRODUCT_EXCLUDED_COUNTRY_CODES.has(country) || !isPhoneCountryCode(country)) {
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
  phoneNumber: PhoneNumber | undefined;
  /** What `AsYouType#input` returned: the entry formatted as far as its digits allow. */
  formatted: string;
};

/** One libphonenumber parse. Callers read both results from it rather than parse twice. */
function parsePhoneInput(
  input: string,
  country: CountryCode | undefined,
  metadata: MetadataJson
): ParsedPhoneInput {
  if (!input) {
    return { phoneNumber: undefined, formatted: "" };
  }
  const asYouType = new AsYouType(country, metadata);
  const formatted = asYouType.input(input);
  return { phoneNumber: asYouType.getNumber(), formatted };
}

/** Digits entered with their own `+` prefix carry an identity independent of the picker country. */
function hasInternationalDigits(digits: string): boolean {
  return digits.startsWith(INTERNATIONAL_PREFIX);
}

/** The full international form of a snapshot, used to re-read it under another catalog. */
export function toInternationalInput({ digits, country }: ProcessedPhoneInput): string {
  return !digits || hasInternationalDigits(digits) ? digits : country.dialCode + digits;
}

function toE164Digits(digits: string): string {
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
 * The two display switches, passed as one object so the call site cannot transpose them
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

function hasInternationalPrefix(input: string): boolean {
  return hasInternationalDigits(input) || input.startsWith(ITU_INTERNATIONAL_PREFIX);
}

function normalizeInternationalPrefix(input: string): string {
  if (input.startsWith(ITU_INTERNATIONAL_PREFIX)) {
    return INTERNATIONAL_PREFIX + input.substring(ITU_INTERNATIONAL_PREFIX.length);
  }
  return input;
}

/** Country from an already-normalized `+` international number. */
function detectCountryFromInput(input: string, metadata: MetadataJson): CountryCode | undefined {
  if (!hasInternationalDigits(input)) {
    return undefined;
  }
  return parsePhoneInput(input, undefined, metadata).phoneNumber?.country;
}

export type ProcessedPhoneInput = {
  digits: string;
  country: PhoneNumberCountry;
  /**
   * The digits are the national number libphonenumber parsed from an international entry, not
   * what was typed. They carry no trunk prefix, so they display as that national number, in
   * the national format under `formatOnType`, rather than as typed.
   */
  parsedNational?: boolean;
};

/** Options for {@link processInputWithDetection}. */
export type ProcessInputOptions = {
  input: string;
  currentCountry: PhoneNumberCountry;
  countries: readonly PhoneNumberCountry[];
  autoDetectCountry: boolean;
  international: boolean;
  metadata: MetadataJson;
};

export function processInputWithDetection({
  input,
  currentCountry,
  countries,
  autoDetectCountry,
  international,
  metadata,
}: ProcessInputOptions): ProcessedPhoneInput {
  if (!hasInternationalPrefix(input)) {
    return { digits: input, country: currentCountry };
  }

  const normalized = normalizeInternationalPrefix(input);
  if (!autoDetectCountry) return { digits: normalized, country: currentCountry };
  const detected = detectCountryFromInput(normalized, metadata);
  const nextCountry = detected ? countries.find((row) => row.code === detected) : undefined;
  const country = nextCountry && nextCountry.code !== currentCountry.code ? nextCountry : currentCountry;

  if (!international && nextCountry) {
    const { phoneNumber } = parsePhoneInput(normalized, country.code, metadata);
    return phoneNumber
      ? { digits: phoneNumber.nationalNumber, country, parsedNational: true }
      : { digits: normalized, country };
  }

  return { digits: normalized, country };
}

export type PhoneFieldValues = {
  displayValue: string;
  outputValue: string;
};

/** Options for {@link resolvePhoneFieldValues}. */
export type ResolvePhoneFieldValuesOptions = {
  digits: string;
  parsedNational?: boolean;
  country: CountryCode | undefined;
  metadata: MetadataJson;
  outputFormat: PhoneNumberFormat;
  international: boolean;
  formatOnType: boolean;
};

export function resolvePhoneFieldValues({
  digits,
  parsedNational,
  country,
  metadata,
  outputFormat,
  international,
  formatOnType,
}: ResolvePhoneFieldValuesOptions): PhoneFieldValues {
  if (!digits) {
    return { displayValue: "", outputValue: "" };
  }
  // A national draft parses as a national entry, with the country as its default. The
  // as-you-type output then keeps a typed trunk prefix for the display ("070-1", where behind
  // the calling code it reads "+46 070 1"), and every country's trunk prefix stays out of the
  // number: behind the calling code, Kazakhstan's 8 or Uruguay's 0 was read as part of it.
  // A typed draft at a local number's length takes local-dialling rules: with Anguilla
  // selected, "2351234" submits as +12642351234, and a typed ten-digit number passes through
  // such a value at its seventh key. Detected digits are already a national number, so they
  // parse behind the calling code again, where a partial one takes no such rule.
  const parsed = parsePhoneInput(
    parsedNational ? getInternationalPrefix(country, metadata) + digits : digits,
    country,
    metadata
  );
  return {
    displayValue: getDisplayValue(parsed, { digits, parsedNational }, country, {
      international,
      formatOnType,
    }),
    outputValue: formatOutputValue(parsed.phoneNumber, digits, outputFormat),
  };
}

export { metadataJson as defaultMetadata };
