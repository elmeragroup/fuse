/**
 * The PhoneNumberField picker contract, written out as the test's own expectation rather
 * than imported from `phone-engine`.
 * Both lists define the country-picker contract; changing either is a product /
 * compliance decision, and this file is the copy the suites compare against.
 */

/** The 28 product/compliance exclusions. */
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

/** libphonenumber codes with no packaged flag SVG. */
export const FLAG_GAP_COUNTRY_CODES = ["AC", "BQ", "EH", "TA"] as const;

/** The configuration error the hook throws when filtering leaves no picker country. */
export const EMPTY_PICKER_ERROR_MESSAGE =
  "PhoneNumberField: no picker countries remain after intersecting libphonenumber metadata with packaged flag assets and the product exclusion set.";
