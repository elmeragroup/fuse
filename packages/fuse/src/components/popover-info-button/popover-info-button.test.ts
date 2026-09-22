import { LocalizedStringFormatter } from "@internationalized/string";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { popoverInfoButtonStrings } from "./intl";
import { popoverInfoButtonStyles } from "./popover-info-button";

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

  it("carries no key beyond the row owned by PopoverInfoButton", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(popoverInfoButtonStrings.getStringsForLocale(locale)), locale).toEqual([
        "moreInformation",
      ]);
    }
  });
});

const CONTENT_SIZES = ["sm", "default", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"] as const;

const CONTENT_SIZE_CLASS = {
  sm: "max-w-sm",
  default: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

describe("popoverInfoButtonStyles", () => {
  it("keeps the content base and maps every contentSize onto max-w-*", () => {
    const defaults = popoverInfoButtonStyles();
    expect(defaults.icon()).toContain("size-4");
    expect(defaults.content()).toContain("w-auto");
    expect(defaults.content()).toContain("p-4");
    expect(defaults.content()).toContain("text-sm");
    expect(defaults.content()).toContain("max-w-md");

    for (const size of CONTENT_SIZES) {
      const maxWidth = CONTENT_SIZE_CLASS[size];
      const content = popoverInfoButtonStyles({ contentSize: size }).content();
      expect(content, size).toContain(maxWidth);
      expect(content, size).toContain("w-auto");
      expect(content, size).toContain("p-4");
      expect(content, size).toContain("text-sm");
      for (const other of Object.values(CONTENT_SIZE_CLASS)) {
        if (other !== maxWidth) {
          expect(content, size).not.toContain(other);
        }
      }
    }
  });
});
