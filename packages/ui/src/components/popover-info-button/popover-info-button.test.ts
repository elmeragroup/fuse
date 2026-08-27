import { LocalizedStringFormatter } from "@internationalized/string";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { popoverInfoButtonStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "popover-info-button.tsx"), "utf8");
const facade = readFileSync(join(here, "../../popover-info-button.ts"), "utf8");

const MORE_INFORMATION_COPY = {
  "nb-NO": "Mer informasjon",
  "sv-SE": "Mer information",
  "en-US": "More information",
  "fi-FI": "Lisätietoja",
} as const;

const CONTENT_SIZE_CLASSES = {
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

describe("popover-info-button source contract", () => {
  it("is a client composite over public Button and Popover with a private recipe", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).toContain('from "../button/button"');
    expect(source).toContain('from "../popover/popover"');
    expect(source).toContain('from "../../icons/generated/info"');
    expect(source).toContain("Popover.Trigger");
    expect(source).toContain("render={trigger}");
    expect(source).toContain('size = "icon-sm"');
    expect(source).toContain('variant = "ghost"');
    expect(source).toContain('side="right"');
    expect(source).toContain("sideOffset={8}");
    expect(source).toContain("showArrow");
    expect(source).toContain('content: "text-sm w-auto p-4"');
    expect(source).toContain('icon: "size-4"');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("container={container}");
    expect(source).not.toContain("useThemeScopeContainer");
    expect(source).not.toContain("document.body");
    expect(source).not.toContain("react-aria");
    expect(source).not.toContain("@elmeragroup/lib");
    expect(source).not.toContain("lucide");
    expect(source).not.toContain(".ref/");
    expect(existsSync(join(here, "popover-info-button-variants.ts"))).toBe(false);
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain(
      'export { PopoverInfoButton } from "./components/popover-info-button/popover-info-button"'
    );
    expect(facade).toContain(
      'export type { PopoverInfoButtonProps } from "./components/popover-info-button/popover-info-button"'
    );
    expect(facade).not.toContain("popoverInfoButtonStyles");
    expect(facade).not.toContain("popoverInfoButtonVariants");
    expect(facade).not.toContain("export * from");
  });

  it("maps every contentSize axis value onto the matching max-w class", () => {
    for (const [contentSize, className] of Object.entries(CONTENT_SIZE_CLASSES)) {
      expect(source, contentSize).toContain(className);
    }
    expect(source).toContain('contentSize: "default"');
  });

  it("does not keep destructive classes, dark variants, or density stamps", () => {
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toMatch(/\b(?:dense|comfortable):/);
    expect(source).not.toContain("data-density");
  });
});
