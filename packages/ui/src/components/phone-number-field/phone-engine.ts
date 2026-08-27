import type { CountryCode, MetadataJson, PhoneNumber } from "libphonenumber-js/core";
import {
  AsYouType,
  getCountries as getMetadataCountries,
  getCountryCallingCode,
  isPossiblePhoneNumber,
  isValidPhoneNumber,
} from "libphonenumber-js/core";
import defaultMetadata from "libphonenumber-js/metadata.min.json";

import { flagAssets } from "../../flags";
import type { FlagAssetCode } from "../../flags";

/** Product/compliance exclusion copied from the reference (phone-number-field.md §3). */
export const PRODUCT_EXCLUDED_COUNTRY_CODES = new Set<CountryCode>([
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

/** libphonenumber-js@1.13.9 codes with no packaged flag SVG (architecture.md §6a). */
export const UNRESOLVED_LIBPHONENUMBER_FLAG_GAP = ["AC", "BQ", "EH", "TA"] as const;

export const DEFAULT_COUNTRY_CODE = "NO";

export const INTERNATIONAL_PREFIX = "+";

export const ITU_INTERNATIONAL_PREFIX = "00";

const PHONE_CHAR_REGEX = /[^\d\s+\-()]/g;

export const EMPTY_PICKER_ERROR =
  "PhoneNumberField: no picker countries remain after intersecting libphonenumber metadata with packaged flag assets and the product exclusion set.";

export type PhoneCountryCode = Extract<CountryCode, FlagAssetCode>;

export type PhoneNumberCountry = {
  code: PhoneCountryCode;
  dialCode: string;
};

export type PhoneNumberFormat = "e164" | "international" | "national" | "raw";

export type PhoneNumberValidation = {
  isValid: boolean;
  isPossible: boolean;
  isEmpty: boolean;
  error?: string;
};

// SAFETY: the pinned min metadata JSON is the MetadataJson document libphonenumber-js ships.
const metadataJson: MetadataJson = defaultMetadata;

export function isPhoneCountryCode(code: string): code is PhoneCountryCode {
  return Object.hasOwn(flagAssets, code);
}

export function createCountry(
  country: PhoneCountryCode,
  metadata: MetadataJson = metadataJson
): PhoneNumberCountry {
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

export function getInternationalPrefix(countryCode: CountryCode | undefined, metadata: MetadataJson): string {
  if (!countryCode) {
    return "";
  }
  try {
    return `+${getCountryCallingCode(countryCode, metadata)}`;
  } catch {
    return "";
  }
}

export function parsePhoneNumber(
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

export function buildFullNumber(
  digits: string,
  country: CountryCode | undefined,
  metadata: MetadataJson
): string {
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

export function formatOutputValue(
  phoneNumber: PhoneNumber | undefined,
  digits: string,
  outputFormat: PhoneNumberFormat
): string {
  if (!phoneNumber) {
    return outputFormat === "raw" ? digits : "";
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

export function getDisplayValue(
  phoneNumber: PhoneNumber | undefined,
  digits: string,
  international: boolean,
  formatOnType: boolean,
  country: CountryCode | undefined
): string {
  if (!digits) {
    return "";
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

export function hasInternationalPrefix(input: string): boolean {
  return input.startsWith(INTERNATIONAL_PREFIX) || input.startsWith(ITU_INTERNATIONAL_PREFIX);
}

export function normalizeInternationalPrefix(input: string): string {
  if (input.startsWith(ITU_INTERNATIONAL_PREFIX)) {
    return INTERNATIONAL_PREFIX + input.substring(ITU_INTERNATIONAL_PREFIX.length);
  }
  return input;
}

/** Country from an already-normalized `+` international number. */
export function detectCountryFromInput(input: string, metadata: MetadataJson): CountryCode | undefined {
  if (!input.startsWith(INTERNATIONAL_PREFIX)) {
    return undefined;
  }
  return parsePhoneNumber(input, undefined, metadata)?.country;
}

export function processInputWithDetection(
  input: string,
  currentCountry: PhoneNumberCountry,
  countries: readonly PhoneNumberCountry[],
  autoDetectCountry: boolean,
  international: boolean,
  metadata: MetadataJson
): { digits: string; country: PhoneNumberCountry } {
  if (!autoDetectCountry || !hasInternationalPrefix(input)) {
    return { digits: input, country: currentCountry };
  }

  const normalized = normalizeInternationalPrefix(input);
  const detected = detectCountryFromInput(normalized, metadata);
  const nextCountry = detected ? countries.find((row) => row.code === detected) : undefined;

  if (!nextCountry || nextCountry.code === currentCountry.code) {
    return { digits: input, country: currentCountry };
  }

  if (!international) {
    const phoneNumber = parsePhoneNumber(normalized, nextCountry.code, metadata);
    return {
      digits: phoneNumber?.nationalNumber ?? normalized,
      country: nextCountry,
    };
  }

  return { digits: normalized, country: nextCountry };
}

export function resolvePhoneFieldValues(
  digits: string,
  country: CountryCode | undefined,
  metadata: MetadataJson,
  outputFormat: PhoneNumberFormat,
  international: boolean,
  formatOnType: boolean
): { displayValue: string; outputValue: string } {
  if (!digits) {
    return { displayValue: "", outputValue: "" };
  }
  const fullNumber = buildFullNumber(digits, country, metadata);
  const phoneNumber = parsePhoneNumber(fullNumber, country, metadata);
  return {
    displayValue: getDisplayValue(phoneNumber, digits, international, formatOnType, country),
    outputValue: formatOutputValue(phoneNumber, digits, outputFormat),
  };
}

export function getInitialPhoneDigits(
  value: string,
  country: CountryCode | undefined,
  international: boolean,
  metadata: MetadataJson
): string {
  if (!value) {
    return "";
  }
  const phoneNumber = parsePhoneNumber(value, country, metadata);
  if (phoneNumber) {
    if (!international && country) {
      return phoneNumber.nationalNumber || "";
    }
    return phoneNumber.number || value;
  }
  return value;
}

export function getPhoneNumberValidation(
  value: string,
  country: CountryCode | undefined,
  required: boolean,
  metadata: MetadataJson = metadataJson
): PhoneNumberValidation {
  const isEmpty = !value.trim();
  if (isEmpty) {
    return {
      isEmpty,
      isValid: !required,
      isPossible: !required,
      error: required ? "Phone number is required" : undefined,
    };
  }
  const isValid = country
    ? isValidPhoneNumber(value, country, metadata)
    : isValidPhoneNumber(value, metadata);
  const isPossible = country
    ? isPossiblePhoneNumber(value, country, metadata)
    : isPossiblePhoneNumber(value, metadata);
  return {
    isEmpty,
    isValid,
    isPossible,
    error: !isValid
      ? !isPossible
        ? "Invalid phone number format"
        : "Phone number appears incomplete"
      : undefined,
  };
}

export { metadataJson as defaultMetadata };
