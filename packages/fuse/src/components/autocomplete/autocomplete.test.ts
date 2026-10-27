import { LocalizedStringFormatter } from "@internationalized/string";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { autocompleteStrings } from "./intl";

const EMPTY_COPY = {
  "nb-NO": "Ingen resultater.",
  "sv-SE": "Inga resultat.",
  "en-US": "No results.",
  "fi-FI": "Ei tuloksia.",
} as const;

const CLEAR_COPY = {
  "nb-NO": "Tøm teksten",
  "sv-SE": "Rensa texten",
  "en-US": "Clear text",
  "fi-FI": "Tyhjennä teksti",
} as const;

const TOGGLE_COPY = {
  "nb-NO": "Vis eller skjul forslag",
  "sv-SE": "Visa eller dölj förslag",
  "en-US": "Toggle suggestions",
  "fi-FI": "Näytä tai piilota ehdotukset",
} as const;

describe("autocomplete dictionary", () => {
  it("owns exactly the three autocomplete.* rows in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(autocompleteStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "clear",
        "empty",
        "toggle",
      ]);
      const formatter = new LocalizedStringFormatter(locale, autocompleteStrings);
      expect(formatter.format("empty"), locale).toBe(EMPTY_COPY[locale]);
      expect(formatter.format("clear"), locale).toBe(CLEAR_COPY[locale]);
      expect(formatter.format("toggle"), locale).toBe(TOGGLE_COPY[locale]);
    }
  });
});
