import { getCountries as getMetadataCountries } from "libphonenumber-js/core";
import type { CountryCode, MetadataJson } from "libphonenumber-js/core";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import {
  EMPTY_PICKER_ERROR_MESSAGE,
  EXCLUDED_PRODUCT_COUNTRY_CODES,
  FLAG_GAP_COUNTRY_CODES,
} from "../../../test/phone-picker-contract";
import { flagAssets } from "../../flags";
import { phoneNumberFieldStrings } from "./intl";
import {
  defaultMetadata,
  getCountries,
  processInputWithDetection,
  requirePickerCountries,
  resolveSelectedCountry,
  resolvePhoneFieldValues,
} from "./phone-engine";

describe("phone-number-field dictionary", () => {
  it("carries no key beyond the three rows owned by PhoneNumberField", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(phoneNumberFieldStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "noCountries",
        "searchCountries",
        "selectCountry",
      ]);
    }
  });
});

describe("phone-number-field picker set", () => {
  it("is exactly libphonenumber's countries, minus the flag gap, minus the product exclusions", () => {
    const codes = getCountries().map((country) => country.code);
    // Derived from libphonenumber and the flag manifest directly, so this is a two-way
    // guard: a code wrongly added to the engine's exclusion set disappears from `codes`
    // while staying in `expected`, and a code wrongly kept shows up the other way round.
    // Counting the test's own literal instead would only restate it.
    const expected = getMetadataCountries(defaultMetadata).filter(
      (code) =>
        Object.hasOwn(flagAssets, code) &&
        !EXCLUDED_PRODUCT_COUNTRY_CODES.some((excluded) => excluded === code)
    );
    expect(codes).toEqual(expected);
    expect(codes).toContain("NO");
    expect(codes).toContain("SE");
    expect(codes).toContain("FI");
    for (const code of FLAG_GAP_COUNTRY_CODES) {
      expect(codes, code).not.toContain(code);
      expect(Object.hasOwn(flagAssets, code), code).toBe(false);
    }
  });

  it("throws when filtering leaves no picker country", () => {
    // SAFETY: empty countries/calling-codes is a valid MetadataJson shape for the empty-picker case.
    const empty = { country_calling_codes: {}, countries: {} } as MetadataJson;
    expect(getCountries(empty)).toEqual([]);
    expect(() => requirePickerCountries([])).toThrow(EMPTY_PICKER_ERROR_MESSAGE);
  });

  it("falls back from an unresolved default to NO, then the first picker country", () => {
    const countries = getCountries();
    const norway = countries.find((country) => country.code === "NO");
    expect(norway).toBeDefined();
    expect(resolveSelectedCountry(countries, "AC").code).toBe("NO");
    expect(resolveSelectedCountry(countries, "BQ").code).toBe("NO");
    expect(resolveSelectedCountry(countries, "EH").code).toBe("NO");
    expect(resolveSelectedCountry(countries, "TA").code).toBe("NO");
    expect(resolveSelectedCountry(countries, "AF").code).toBe("NO");
    const withoutNorway = countries.filter((country) => country.code !== "NO");
    expect(resolveSelectedCountry(withoutNorway, "AC").code).toBe(withoutNorway[0]?.code);
  });

  it("auto-detects picker countries and never commits AC, BQ, EH, or TA", () => {
    const countries = getCountries();
    const norway = countries.find((country) => country.code === "NO");
    expect(norway).toBeDefined();
    if (!norway) {
      return;
    }

    const detect = (input: string, autoDetectCountry = true) =>
      processInputWithDetection({
        input,
        currentCountry: norway,
        countries,
        autoDetectCountry,
        international: false,
        metadata: defaultMetadata,
      });

    const sweden = detect("+46701234567");
    expect(sweden.country.code).toBe("SE");
    expect(sweden.digits).toBe("701234567");

    const ituPrefix = detect("0046701234567");
    expect(ituPrefix.country.code).toBe("SE");
    expect(ituPrefix.digits).toBe("701234567");

    const sameCountryItu = detect("004741234567");
    expect(sameCountryItu.country.code).toBe("NO");
    expect(sameCountryItu.digits).toBe("41234567");

    const unchanged = detect("+46701234567", false);
    expect(unchanged.country.code).toBe("NO");
    expect(unchanged.digits).toBe("+46701234567");

    const ac = detect("+24712345");
    expect(ac.country.code).toBe("NO");
    expect(ac.digits).toBe("+24712345");
    expect(FLAG_GAP_COUNTRY_CODES).not.toContain(ac.country.code);
  });
});

describe("phone number international identity", () => {
  it("preserves the full input 0024712345 through detection and output", () => {
    const countries = getCountries();
    const currentCountry = resolveSelectedCountry(countries, "NO");
    const next = processInputWithDetection({
      input: "0024712345",
      currentCountry,
      countries,
      autoDetectCountry: true,
      international: false,
      metadata: defaultMetadata,
    });
    const values = resolvePhoneFieldValues({
      digits: next.digits,
      country: next.country.code,
      metadata: defaultMetadata,
      outputFormat: "e164",
      international: false,
      formatOnType: false,
    });
    expect(values.outputValue).toBe("+24712345");
  });
});

describe("national drafts with a trunk prefix", () => {
  const resolve = (country: CountryCode, digits: string, formatOnType: boolean) =>
    resolvePhoneFieldValues({
      digits,
      country,
      metadata: defaultMetadata,
      outputFormat: "e164",
      international: false,
      formatOnType,
    });

  // libphonenumber's national formats of each country's mobile example, trunk prefix included.
  it.each([
    ["SE", "0701234567", "070-123 45 67", "+46701234567"],
    ["GB", "07700900123", "07700 900123", "+447700900123"],
    ["DE", "015112345678", "01511 2345678", "+4915112345678"],
    ["FI", "0401234567", "040 1234567", "+358401234567"],
    ["KZ", "87710009998", "8 (771) 000 9998", "+77710009998"],
    // An Italian leading 0 is part of the number, not a trunk prefix.
    ["IT", "0212345678", "02 1234 5678", "+390212345678"],
  ] as const)(
    "keeps the %s draft %s on display and submits the number without it",
    (country, digits, formatted, e164) => {
      expect(resolve(country, digits, false)).toEqual({ displayValue: digits, outputValue: e164 });
      expect(resolve(country, digits, true)).toEqual({ displayValue: formatted, outputValue: e164 });
    }
  );

  it("strips separators from an unformatted national draft", () => {
    expect(resolve("SE", "070 123-45 67", false).displayValue).toBe("0701234567");
  });

  it("reads digits detected from a partial international entry behind the calling code", () => {
    // As a national entry, Anguilla's seven digits would take its local-dialling rule, which
    // adds the 264 area code again: "+1 264 264 2351".
    const countries = getCountries();
    const detected = processInputWithDetection({
      input: "+12642351",
      currentCountry: resolveSelectedCountry(countries, "NO"),
      countries,
      autoDetectCountry: true,
      international: false,
      metadata: defaultMetadata,
    });
    expect(detected.country.code).toBe("AI");
    expect(detected).toMatchObject({ digits: "2642351", parsedNational: true });
    for (const formatOnType of [false, true]) {
      expect(
        resolvePhoneFieldValues({
          ...detected,
          country: detected.country.code,
          metadata: defaultMetadata,
          outputFormat: "e164",
          international: false,
          formatOnType,
        })
      ).toEqual({ displayValue: "2642351", outputValue: "+12642351" });
    }
  });

  it("keeps the national format for digits detected from an international entry", () => {
    const countries = getCountries();
    const sweden = resolveSelectedCountry(countries, "SE");
    const detected = processInputWithDetection({
      input: "+46701234567",
      currentCountry: sweden,
      countries,
      autoDetectCountry: true,
      international: false,
      metadata: defaultMetadata,
    });
    expect(detected).toEqual({ digits: "701234567", country: sweden, parsedNational: true });
    expect(
      resolvePhoneFieldValues({
        ...detected,
        country: detected.country.code,
        metadata: defaultMetadata,
        outputFormat: "e164",
        international: false,
        formatOnType: true,
      }).displayValue
    ).toBe("070-123 45 67");
  });
});
