import { LocalizedStringFormatter } from "@internationalized/string";
import { getCountries as getMetadataCountries } from "libphonenumber-js/core";
import type { MetadataJson } from "libphonenumber-js/core";
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
  cleanPhoneInput,
  defaultMetadata,
  getCountries,
  processInputWithDetection,
  requirePickerCountries,
  resolveSelectedCountry,
  resolvePhoneFieldValues,
} from "./phone-engine";

const SELECT_COUNTRY_COPY = {
  "nb-NO": "Velg land",
  "sv-SE": "Välj land",
  "en-US": "Select country",
  "fi-FI": "Valitse maa",
} as const;

const SEARCH_COUNTRIES_COPY = {
  "nb-NO": "Søk etter land",
  "sv-SE": "Sök efter länder",
  "en-US": "Search countries",
  "fi-FI": "Hae maita",
} as const;

const NO_COUNTRIES_COPY = {
  "nb-NO": "Ingen land funnet.",
  "sv-SE": "Inga länder hittades.",
  "en-US": "No countries found.",
  "fi-FI": "Maita ei löytynyt.",
} as const;

describe("phone-number-field dictionary", () => {
  it("owns the locked phoneNumberField.* copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const formatter = new LocalizedStringFormatter(locale, phoneNumberFieldStrings);
      expect(formatter.format("selectCountry"), locale).toBe(SELECT_COUNTRY_COPY[locale]);
      expect(formatter.format("searchCountries"), locale).toBe(SEARCH_COUNTRIES_COPY[locale]);
      expect(formatter.format("noCountries"), locale).toBe(NO_COUNTRIES_COPY[locale]);
    }
  });

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

  it("cleans paste/input by stripping letters while keeping phone punctuation", () => {
    expect(cleanPhoneInput("41234567abc")).toBe("41234567");
    expect(cleanPhoneInput("+47 412-34-567")).toBe("+47 412-34-567");
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
  it.each(["+24712345", "+79123456789", "0024712345", "+46701234567"])(
    "preserves the full input %s through detection and output",
    (input) => {
      const countries = getCountries();
      const currentCountry = resolveSelectedCountry(countries, "NO");
      const next = processInputWithDetection({
        input,
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
      expect(values.outputValue).toBe(input.replace(/^00/, "+"));
    }
  );
});
