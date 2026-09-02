import { LocalizedStringFormatter } from "@internationalized/string";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { popoverInfoButtonStrings } from "./intl";

const MORE_INFORMATION_COPY = {
  "nb-NO": "Mer informasjon",
  "sv-SE": "Mer information",
  "en-US": "More information",
  "fi-FI": "Lisätietoja",
} as const;

describe("popover-info-button dictionary", () => {
  it("owns the locked popoverInfoButton.moreInformation copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const formatter = new LocalizedStringFormatter(locale, popoverInfoButtonStrings);
      expect(formatter.format("moreInformation"), locale).toBe(MORE_INFORMATION_COPY[locale]);
    }
  });

  it("carries no key beyond the row accessibility.md §4.1 assigns to PopoverInfoButton", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(popoverInfoButtonStrings.getStringsForLocale(locale)), locale).toEqual([
        "moreInformation",
      ]);
    }
  });
});
