/**
 * The PhoneNumberField picker contract, written out as the test's own expectation rather
 * than imported from `phone-engine` (ADR 0008: tests assert behaviour, not source
 * spelling — reading the implementation's own Set back made both assertions tautologies).
 * Both lists are normative in phone-number-field.md §3; changing either is a product /
 * compliance decision, and this file is the copy the suites compare against.
 */

/** The 28 product/compliance exclusions (phone-number-field.md §3). */
export const EXCLUDED_PRODUCT_COUNTRY_CODES = [
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
] as const;

/** libphonenumber codes with no packaged flag SVG (architecture.md §6a). */
export const FLAG_GAP_COUNTRY_CODES = ["AC", "BQ", "EH", "TA"] as const;

/** The configuration error the hook throws when filtering leaves no picker country. */
export const EMPTY_PICKER_ERROR_MESSAGE =
  "PhoneNumberField: no picker countries remain after intersecting libphonenumber metadata with packaged flag assets and the product exclusion set.";
