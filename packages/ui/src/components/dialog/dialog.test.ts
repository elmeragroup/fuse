import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { dialogStrings } from "./intl";

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

describe("dialog dictionary", () => {
  it("owns the locked dialog.close copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(dialogStrings.getStringForLocale("close", locale), locale).toBe(CLOSE_COPY[locale]);
    }
  });

  it("carries no key beyond the one row accessibility.md §4.1 assigns to Dialog", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(dialogStrings.getStringsForLocale(locale)), locale).toEqual(["close"]);
    }
  });
});
