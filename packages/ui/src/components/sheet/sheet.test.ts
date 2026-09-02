import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { sheetStrings } from "./intl";
import { SIDE_TO_SWIPE_DIRECTION } from "./sheet";

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

describe("sheet dictionary", () => {
  it("owns the locked sheet.close copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(sheetStrings.getStringForLocale("close", locale), locale).toBe(CLOSE_COPY[locale]);
    }
  });

  it("carries no key beyond the one row accessibility.md §4.1 assigns to Sheet", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(sheetStrings.getStringsForLocale(locale)), locale).toEqual(["close"]);
    }
  });
});

describe("SIDE_TO_SWIPE_DIRECTION", () => {
  it("maps each side to the swipe direction that dismisses toward that edge", () => {
    expect(SIDE_TO_SWIPE_DIRECTION).toEqual({
      top: "up",
      right: "right",
      bottom: "down",
      left: "left",
    });
  });
});
