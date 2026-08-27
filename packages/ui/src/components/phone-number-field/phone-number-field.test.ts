import { LocalizedStringFormatter } from "@internationalized/string";
import type { MetadataJson } from "libphonenumber-js/core";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
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

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "phone-number-field.tsx"), "utf8");
const flagSource = readFileSync(join(here, "flag.tsx"), "utf8");
const engineSource = readFileSync(join(here, "phone-engine.ts"), "utf8");
const hookSource = readFileSync(join(here, "hooks/use-phone-number-field-state.ts"), "utf8");
const facade = readFileSync(join(here, "../../phone-number-field.ts"), "utf8");

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

function walkSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkSources(path);
    }
    if (/\.test(?:-d)?\./.test(entry.name)) {
      return [];
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      return [readFileSync(path, "utf8")];
    }
    return [];
  });
}

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

describe("phone-number-field source contract", () => {
  it("imports Combobox from the @base-ui/react package root, never the combobox subpath or public Combobox", () => {
    expect(source).toContain('from "@base-ui/react"');
    expect(source).not.toContain('from "@base-ui/react/combobox"');
    expect(source).not.toContain("@elmeragroup/ui/combobox");
    expect(source).toContain("null React context");
  });

  it("keeps the two-input pattern, button trigger, and conditional aria spread", () => {
    expect(source).toContain("${name}-display-value");
    expect(source).toContain('type="hidden"');
    expect(source).toContain("phone.outputValue");
    expect(source).toContain('role="button"');
    expect(source).toContain("aria-labelledby={undefined}");
    expect(source).toContain("ariaProps");
    expect(source).toContain("onPaste={phone.handlePaste}");
    expect(hookSource).toContain("event.preventDefault()");
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain('autoComplete="one-time-code"');
    expect(source).toContain('form="elmera-ui-phone-country-unbound"');
    expect(source).toContain("useThemeScopeContainer");
    expect(source).toContain("overlayLayer");
    expect(source).toContain("w-(--anchor-width)");
    expect(source).toContain("sideOffset={6}");
    expect(source).not.toContain("document.body");
    expect(source).not.toContain("z-50");
  });

  it("renders packaged flags only and deletes emoji, CDN, and UA branches", () => {
    const sources = walkSources(here).join("\n");
    expect(flagSource).toContain("flagAssets[country]");
    expect(flagSource).toContain('alt=""');
    expect(flagSource).toContain('aria-hidden="true"');
    expect(flagSource).toContain("width={20}");
    expect(flagSource).toContain("height={15}");
    expect(flagSource).toContain('loading="lazy"');
    expect(flagSource).toContain('decoding="async"');
    expect(flagSource).toContain("draggable={false}");
    expect(sources).not.toContain("flagcdn.com");
    expect(sources).not.toContain("getCountryUnicodeFlag");
    expect(sources).not.toContain("getRegionalIndicatorSymbol");
    expect(sources).not.toContain("0x1f1e6");
    expect(sources).not.toContain("userAgent");
    expect(sources).not.toContain("OS_NAMES_THAT_SUPPORT");
    expect(flagSource).not.toMatch(/https?:\/\//);
    expect(flagSource).not.toContain("data:");
    expect(flagSource).not.toContain("blob:");
    expect(flagAssets.NO).not.toMatch(/^(https?:|data:|blob:)/);
    expect(flagAssets.SE).not.toMatch(/^(https?:|data:|blob:)/);
    expect(flagAssets.FI).not.toMatch(/^(https?:|data:|blob:)/);
    expect(engineSource).not.toContain("flagcdn.com");
    expect(engineSource).toContain("isPhoneCountryCode");
    expect(engineSource).toContain("processInputWithDetection");
    expect(hookSource).toContain("decodeURIComponent");
    expect(hookSource).toContain("selectCountry");
  });

  it("is a client composite that borrows textFieldVariants and Phosphor icons", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).toContain("textFieldVariants");
    expect(source).toContain('from "../../icons/generated/check"');
    expect(source).toContain('from "../../icons/generated/magnifying-glass"');
    expect(source).toContain("Check");
    expect(source).toContain("MagnifyingGlass");
    expect(source).not.toContain("CheckIcon");
    expect(source).not.toContain("lucide");
    expect(source).not.toContain("@elmeragroup/lib");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("document.documentElement.lang");
    expect(existsSync(join(here, "phone-number-field-variants.ts"))).toBe(false);
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export * from");
    expect(facade).toContain(
      'export { PhoneNumberField } from "./components/phone-number-field/phone-number-field"'
    );
    expect(facade).toContain(
      'export type { PhoneNumberFieldProps } from "./components/phone-number-field/phone-number-field"'
    );
    expect(facade).not.toContain("Flag");
    expect(facade).not.toContain("usePhoneNumberFieldState");
  });

  it("does not keep destructive classes, dark variants, or density stamps", () => {
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toMatch(/\b(?:dense|comfortable):/);
    expect(source).not.toContain("data-density");
    expect(flagSource).not.toMatch(RAW_PALETTE_RE);
    expect(flagSource).not.toContain("dark:");
  });
});
