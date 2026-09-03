import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../../test/locale-matrix";
import { overlayCloseStrings } from "./index";

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

describe("overlay close dictionary", () => {
  it("carries the locked close copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(overlayCloseStrings.getStringForLocale("close", locale), locale).toBe(CLOSE_COPY[locale]);
    }
  });

  it("carries no key beyond the one row accessibility.md §4.1 assigns to the overlay family", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(overlayCloseStrings.getStringsForLocale(locale)), locale).toEqual(["close"]);
    }
  });
});
