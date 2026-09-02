import { LocalizedStringFormatter } from "@internationalized/string";
import type { MetadataJson } from "libphonenumber-js/core";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { flagAssets } from "../../flags";
import { phoneNumberFieldStrings } from "./intl";
import {
  EMPTY_PICKER_ERROR,
  PRODUCT_EXCLUDED_COUNTRY_CODES,
  UNRESOLVED_LIBPHONENUMBER_FLAG_GAP,
  cleanPhoneInput,
  defaultMetadata,
  getCountries,
  processInputWithDetection,
  requirePickerCountries,
  resolveSelectedCountry,
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

  it("carries no key beyond the three rows accessibility.md §4.1 assigns to PhoneNumberField", () => {
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
  it("never includes AC, BQ, EH, TA or the 28 excluded product countries", () => {
    const countries = getCountries();
    const codes = countries.map((country) => country.code);
    expect(codes).toContain("NO");
    expect(codes).toContain("SE");
    expect(codes).toContain("FI");
    for (const code of UNRESOLVED_LIBPHONENUMBER_FLAG_GAP) {
      expect(codes, code).not.toContain(code);
    }
    for (const code of PRODUCT_EXCLUDED_COUNTRY_CODES) {
      expect(codes, code).not.toContain(code);
    }
    for (const country of countries) {
      expect(Object.hasOwn(flagAssets, country.code), country.code).toBe(true);
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
    expect(() => requirePickerCountries([])).toThrow(EMPTY_PICKER_ERROR);
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

    const sweden = processInputWithDetection("+46701234567", norway, countries, true, false, defaultMetadata);
    expect(sweden.country.code).toBe("SE");
    expect(sweden.digits).toBe("701234567");

    const ituPrefix = processInputWithDetection(
      "0046701234567",
      norway,
      countries,
      true,
      false,
      defaultMetadata
    );
    expect(ituPrefix.country.code).toBe("SE");
    expect(ituPrefix.digits).toBe("701234567");

    const sameCountryItu = processInputWithDetection(
      "004741234567",
      norway,
      countries,
      true,
      false,
      defaultMetadata
    );
    expect(sameCountryItu.country.code).toBe("NO");
    expect(sameCountryItu.digits).toBe("41234567");

    const unchanged = processInputWithDetection(
      "+46701234567",
      norway,
      countries,
      false,
      false,
      defaultMetadata
    );
    expect(unchanged.country.code).toBe("NO");
    expect(unchanged.digits).toBe("+46701234567");

    const ac = processInputWithDetection("+24712345", norway, countries, true, false, defaultMetadata);
    expect(ac.country.code).toBe("NO");
    expect(ac.digits).toBe("12345");
    expect(UNRESOLVED_LIBPHONENUMBER_FLAG_GAP).not.toContain(ac.country.code);
  });
});
