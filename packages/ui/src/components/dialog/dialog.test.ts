import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { dialogStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "dialog.tsx"), "utf8");
const closeButtonSource = readFileSync(join(here, "../overlay/overlay-close-button.tsx"), "utf8");

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

describe("dialog source contract", () => {
  it("ships every spec §10 demo as a runnable file", () => {
    for (const demo of [
      "dialog-basic.tsx",
      "dialog-sizes.tsx",
      "dialog-footer-close.tsx",
      "dialog-no-close-button.tsx",
      "dialog-scrolling.tsx",
    ]) {
      expect(existsSync(join(here, "demos", demo)), demo).toBe(true);
    }
  });

  it("declares the overlay layer once and never falls back to document.body", () => {
    // Source-grep: a single z-50 declaration (dialog.md §8.4) and the absence of a
    // body fallback (theming.md §7.4) have no consumer-behavior probe of their own.
    expect(source.match(/z-50/gu)).toHaveLength(1);
    expect(source).not.toContain("document.body");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
  });

  it("emits data-slot before the props spread on every rendering part", () => {
    for (const slot of [
      "dialog",
      "dialog-trigger",
      "dialog-portal",
      "dialog-close",
      "dialog-overlay",
      "dialog-content",
      "dialog-header",
      "dialog-footer",
      "dialog-title",
      "dialog-description",
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

  it("keeps the close-button helper out of styles/utils and consumes it for both affordances", () => {
    expect(readFileSync(join(here, "../../styles/utils.ts"), "utf8")).not.toContain("CloseButton");
    expect(source).toContain("overlayCornerCloseButton");
    expect(source).toContain("overlayFooterCloseButton");
    expect(closeButtonSource).toContain("hit-area-1");
    expect(closeButtonSource).toContain("sr-only");
    expect(closeButtonSource).toContain('size="icon-sm"');
    expect(closeButtonSource).toContain('variant="ghost"');
  });

  it("starts with the use client directive", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(closeButtonSource.trimStart().startsWith('"use client"')).toBe(true);
  });
});
