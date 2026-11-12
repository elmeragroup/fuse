import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { searchFieldStrings } from "./intl";

const CLEAR_COPY = {
  "nb-NO": "Tøm søket",
  "sv-SE": "Rensa sökningen",
  "en-US": "Clear search",
  "fi-FI": "Tyhjennä haku",
} as const;

describe("search-field dictionary", () => {
  it("owns the locked searchField.clear copy, and no other key, in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(searchFieldStrings.getStringForLocale("clear", locale), locale).toBe(CLEAR_COPY[locale]);
      expect(Object.keys(searchFieldStrings.getStringsForLocale(locale)), locale).toEqual(["clear"]);
    }
  });
});
