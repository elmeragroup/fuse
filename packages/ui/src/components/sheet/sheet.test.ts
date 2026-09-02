import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { sheetStrings } from "./intl";
import { SIDE_TO_SWIPE_DIRECTION } from "./sheet";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "sheet.tsx"), "utf8");
const closeButtonSource = readFileSync(join(here, "../overlay/overlay-close-button.tsx"), "utf8");
const overlayClassesSource = readFileSync(join(here, "../overlay/overlay-classes.ts"), "utf8");

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

describe("sheet source contract", () => {
  it("declares the overlay layer once and never falls back to document.body", () => {
    expect(overlayClassesSource.match(/z-50/gu)).toHaveLength(1);
    expect(source).not.toContain("z-50");
    expect(source).toContain("overlayLayer");
    expect(source).not.toContain("document.body");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("swipeDirection?:");
    expect(source).not.toContain("export const sheetContentVariants");
  });

  it("keeps the transition swipe contract and pointer-events viewport hack", () => {
    expect(source).toContain("--drawer-swipe-movement-x");
    expect(source).toContain("--drawer-swipe-movement-y");
    expect(source).toContain("--drawer-swipe-strength");
    expect(source).toContain("data-swiping:transition-none");
    expect(source).toContain("pointer-events-none fixed inset-0");
    expect(source).toContain("VirtualKeyboardProvider");
  });

  it("emits data-slot before the props spread on every rendering part", () => {
    for (const slot of [
      "sheet",
      "sheet-trigger",
      "sheet-close",
      "sheet-portal",
      "sheet-overlay",
      "sheet-viewport",
      "sheet-content",
      "sheet-content-inner",
      "sheet-header",
      "sheet-body",
      "sheet-footer",
      "sheet-title",
      "sheet-description",
    ]) {
      expect(source, slot).toContain(`data-slot="${slot}"`);
    }
    for (const part of source.split("function ").slice(1)) {
      const slot = part.indexOf("data-slot=");
      const spread = part.indexOf("{...props}");
      if (slot === -1 || spread === -1) {
        continue;
      }
      expect(slot).toBeLessThan(spread);
    }
  });

  it("reuses Dialog's shared close-button helper and does not fork it", () => {
    expect(source).toContain("overlayCornerCloseButton");
    expect(source).not.toContain("overlayFooterCloseButton");
    expect(closeButtonSource).toContain("hit-area-1");
    expect(closeButtonSource).toContain("aria-label={label}");
    expect(closeButtonSource).not.toContain("sr-only");
    expect(closeButtonSource).toContain('size="icon-sm"');
    expect(closeButtonSource).toContain('variant="ghost"');
    expect(source).not.toContain("opacity-70");
    expect(source).not.toContain("XIcon");
  });

  it("starts with the use client directive", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });
});
