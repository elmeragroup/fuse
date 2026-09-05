import { LocalizedStringFormatter } from "@internationalized/string";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { comboboxStrings } from "./intl";

const EMPTY_COPY = {
  "nb-NO": "Ingen resultater.",
  "sv-SE": "Inga resultat.",
  "en-US": "No results.",
  "fi-FI": "Ei tuloksia.",
} as const;

const CLEAR_COPY = {
  "nb-NO": "Tøm valg",
  "sv-SE": "Rensa val",
  "en-US": "Clear selection",
  "fi-FI": "Tyhjennä valinta",
} as const;

const REMOVE_APPLE_COPY = {
  "nb-NO": "Fjern Apple",
  "sv-SE": "Ta bort Apple",
  "en-US": "Remove Apple",
  "fi-FI": "Poista Apple",
} as const;

const REMOVE_COPY = {
  "nb-NO": "Fjern",
  "sv-SE": "Ta bort",
  "en-US": "Remove",
  "fi-FI": "Poista",
} as const;

const TOGGLE_COPY = {
  "nb-NO": "Vis eller skjul alternativer",
  "sv-SE": "Visa eller dölj alternativ",
  "en-US": "Toggle options",
  "fi-FI": "Näytä tai piilota vaihtoehdot",
} as const;

describe("combobox dictionary", () => {
  it("owns the locked combobox.* copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const formatter = new LocalizedStringFormatter(locale, comboboxStrings);
      expect(formatter.format("empty"), locale).toBe(EMPTY_COPY[locale]);
      expect(formatter.format("clear"), locale).toBe(CLEAR_COPY[locale]);
      expect(formatter.format("removeItem", { item: "Apple" }), locale).toBe(REMOVE_APPLE_COPY[locale]);
      expect(formatter.format("removeItem", { item: "" }), locale).toBe(REMOVE_COPY[locale]);
      expect(formatter.format("toggle"), locale).toBe(TOGGLE_COPY[locale]);
    }
  });

  it("carries no key beyond the four rows accessibility.md §4.1 assigns to Combobox", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(comboboxStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "clear",
        "empty",
        "removeItem",
        "toggle",
      ]);
    }
  });
});
