import type { CountryCode, MetadataJson, PhoneNumber } from "libphonenumber-js/core";
import {
  AsYouType,
  getCountries as getMetadataCountries,
  getCountryCallingCode,
} from "libphonenumber-js/core";
import defaultMetadata from "libphonenumber-js/metadata.min.json";

import { flagAssets } from "../../flags";
import type { FlagAssetCode } from "../../flags";

/** Product/compliance exclusion copied from the reference (phone-number-field.md §3). */
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

// The four libphonenumber@1.13.9 codes with no packaged flag SVG — AC, BQ, EH, TA — are not
// listed here: `isPhoneCountryCode` filters on the flag manifest itself, so a fifth code
// appearing upstream needs no edit. The four are named in architecture.md §6a, and the picker
// suites assert their absence from their own copy of the list (test/phone-picker-contract.ts).

const DEFAULT_COUNTRY_CODE = "NO";

const INTERNATIONAL_PREFIX = "+";

const ITU_INTERNATIONAL_PREFIX = "00";

const PHONE_CHAR_REGEX = /[^\d\s+\-()]/g;

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

function parsePhoneNumber(
  input: string,
  country: CountryCode | undefined,
  metadata: MetadataJson
): PhoneNumber | undefined {
  if (!input) {
    return undefined;
  }
  const asYouType = new AsYouType(country, metadata);
  asYouType.input(input);
  return asYouType.getNumber();
}

function buildFullNumber(digits: string, country: CountryCode | undefined, metadata: MetadataJson): string {
  if (!digits) {
    return "";
  }
  if (digits.startsWith(INTERNATIONAL_PREFIX)) {
    return digits;
  }
  if (country) {
    return getInternationalPrefix(country, metadata) + digits;
  }
  return digits;
}

function formatOutputValue(
  phoneNumber: PhoneNumber | undefined,
  digits: string,
  outputFormat: PhoneNumberFormat
): string {
  if (!phoneNumber) {
    if (outputFormat === "raw") return digits;
    return outputFormat === "e164" && digits.startsWith("+") ? digits.replace(/[^\d+]/g, "") : "";
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
 * (phone-number-field.md §8.16).
 */
type PhoneDisplayOptions = {
  international: boolean;
  formatOnType: boolean;
};

function getDisplayValue(
  phoneNumber: PhoneNumber | undefined,
  digits: string,
  country: CountryCode | undefined,
  { international, formatOnType }: PhoneDisplayOptions
): string {
  if (!digits) {
    return "";
  }
  if (digits.startsWith("+") && (!phoneNumber?.country || phoneNumber.country !== country)) {
    return formatOnType && phoneNumber ? phoneNumber.formatInternational() : digits.replace(/[^\d+]/g, "");
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

export function cleanPhoneInput(input: string): string {
  return input.replace(PHONE_CHAR_REGEX, "");
}

function hasInternationalPrefix(input: string): boolean {
  return input.startsWith(INTERNATIONAL_PREFIX) || input.startsWith(ITU_INTERNATIONAL_PREFIX);
}

function normalizeInternationalPrefix(input: string): string {
  if (input.startsWith(ITU_INTERNATIONAL_PREFIX)) {
    return INTERNATIONAL_PREFIX + input.substring(ITU_INTERNATIONAL_PREFIX.length);
  }
  return input;
}

/** Country from an already-normalized `+` international number. */
function detectCountryFromInput(input: string, metadata: MetadataJson): CountryCode | undefined {
  if (!input.startsWith(INTERNATIONAL_PREFIX)) {
    return undefined;
  }
  return parsePhoneNumber(input, undefined, metadata)?.country;
}

export type ProcessedPhoneInput = {
  digits: string;
  country: PhoneNumberCountry;
};

/** Options for {@link processInputWithDetection} (phone-number-field.md §8.16). */
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
    const phoneNumber = parsePhoneNumber(normalized, country.code, metadata);
    return {
      digits: phoneNumber?.nationalNumber ?? normalized,
      country,
    };
  }

  return { digits: normalized, country };
}

export type PhoneFieldValues = {
  displayValue: string;
  outputValue: string;
};

/** Options for {@link resolvePhoneFieldValues} (phone-number-field.md §8.16). */
export type ResolvePhoneFieldValuesOptions = {
  digits: string;
  country: CountryCode | undefined;
  metadata: MetadataJson;
  outputFormat: PhoneNumberFormat;
  international: boolean;
  formatOnType: boolean;
};

export function resolvePhoneFieldValues({
  digits,
  country,
  metadata,
  outputFormat,
  international,
  formatOnType,
}: ResolvePhoneFieldValuesOptions): PhoneFieldValues {
  if (!digits) {
    return { displayValue: "", outputValue: "" };
  }
  const fullNumber = buildFullNumber(digits, country, metadata);
  const phoneNumber = parsePhoneNumber(fullNumber, country, metadata);
  return {
    displayValue: getDisplayValue(phoneNumber, digits, country, { international, formatOnType }),
    outputValue: formatOutputValue(phoneNumber, digits, outputFormat),
  };
}

export { metadataJson as defaultMetadata };
