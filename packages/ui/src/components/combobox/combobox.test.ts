import { LocalizedStringFormatter } from "@internationalized/string";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { comboboxStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "combobox.tsx"), "utf8");
const facade = readFileSync(join(here, "../../combobox.ts"), "utf8");
const overlayClassesSource = readFileSync(join(here, "../overlay/overlay-classes.ts"), "utf8");

const EMPTY_COPY = {
  "nb-NO": "Ingen resultater.",
  "sv-SE": "Inga resultat.",
  "en-US": "No results.",
  "fi-FI": "Ei tuloksia.",
} as const;

const CLEAR_COPY = {
  "nb-NO": "Tøm valg",
  "sv-SE": "Rensa val",
  "en-US": "Clear selection",
  "fi-FI": "Tyhjennä valinta",
} as const;

const REMOVE_APPLE_COPY = {
  "nb-NO": "Fjern Apple",
  "sv-SE": "Ta bort Apple",
  "en-US": "Remove Apple",
  "fi-FI": "Poista Apple",
} as const;

const REMOVE_COPY = {
  "nb-NO": "Fjern",
  "sv-SE": "Ta bort",
  "en-US": "Remove",
  "fi-FI": "Poista",
} as const;

describe("combobox dictionary", () => {
  it("owns the locked combobox.* copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const formatter = new LocalizedStringFormatter(locale, comboboxStrings);
      expect(formatter.format("empty"), locale).toBe(EMPTY_COPY[locale]);
      expect(formatter.format("clear"), locale).toBe(CLEAR_COPY[locale]);
      expect(formatter.format("removeItem", { item: "Apple" }), locale).toBe(REMOVE_APPLE_COPY[locale]);
      expect(formatter.format("removeItem", { item: "" }), locale).toBe(REMOVE_COPY[locale]);
    }
  });

  it("carries no key beyond the three rows accessibility.md §4.1 assigns to Combobox", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(comboboxStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "clear",
        "empty",
        "removeItem",
      ]);
    }
  });
});

describe("combobox source contract", () => {
  it("imports Combobox from the @base-ui/react package root, never the combobox subpath", () => {
    // Source-grep: the subpath type-checks but crashes at runtime (combobox.md §8).
    expect(source).toContain('from "@base-ui/react"');
    expect(source).not.toContain('from "@base-ui/react/combobox"');
    expect(source).toContain("null React context");
  });

  it("declares the overlay layer once on the Positioner and never falls back to document.body", () => {
    expect(overlayClassesSource.match(/z-50/gu)).toHaveLength(1);
    expect(source).not.toContain("z-50");
    expect(source).toContain("overlayLayer");
    expect(source).toContain("isolate");
    expect(source).not.toContain("document.body");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("inverted:");
  });

  it("drops destructive chrome, dark: classes, and the dead Item data-variant selector", () => {
    expect(source).not.toContain("data-variant");
    expect(source).not.toContain("not-data-[variant=destructive]");
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).toContain("has-aria-invalid:border-error");
    expect(source).toContain("has-aria-invalid:ring-3");
    expect(source).toContain("has-aria-invalid:ring-error/20");
    expect(source).toContain("data-highlighted:**:text-accent-foreground");
    expect(source).not.toMatch(RAW_PALETTE_RE);
  });

  it("keeps trigger/clear exclusivity, the List max-height calc, and Phosphor icons", () => {
    expect(source).toContain("group-has-data-[slot=combobox-clear]/input-group:hidden");
    expect(source).toContain(
      "max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))]"
    );
    expect(source).toContain('data-chips={anchor ? "true" : "false"}');
    expect(source).toContain("data-[chips=true]:min-w-(--anchor-width)");
    expect(source).toContain("Check");
    expect(source).toContain("CaretDown");
    expect(source).toContain('from "../../icons/generated/x"');
    expect(source).not.toContain("CheckIcon");
    expect(source).not.toContain("Chevron");
    expect(source).not.toContain("lucide");
    expect(source).toContain("Omit<");
    expect(source).toContain('"locale"');
    expect(source).toContain("locale={locale}");
    expect(source).toContain("useElmeraGroupUi");
  });

  it("has no public recipe and composes the shared within focus ring on Chips", () => {
    expect(existsSync(join(here, "combobox-variants.ts"))).toBe(false);
    expect(source).not.toContain("tv(");
    expect(source).toContain("withinFocusRing");
    expect(source).toContain('focusRing({ target: "within" })');
    expect(source).toContain('data-slot="combobox-chip-input"');
    expect(source).toContain("data-focus-ring-control");
    expect(facade).not.toContain("comboboxVariants");
  });

  it("emits data-slot before the props spread on every rendering part", () => {
    for (const slot of [
      "combobox-value",
      "combobox-trigger",
      "combobox-clear",
      "combobox-content",
      "combobox-list",
      "combobox-item",
      "combobox-group",
      "combobox-label",
      "combobox-collection",
      "combobox-empty",
      "combobox-separator",
      "combobox-chips",
      "combobox-chip",
      "combobox-chip-remove",
      "combobox-chip-input",
    ]) {
      expect(source, slot).toContain(`data-slot="${slot}"`);
    }
    expect(source).not.toContain('data-slot="combobox"');
    for (const slot of [
      "combobox-value",
      "combobox-trigger",
      "combobox-clear",
      "combobox-content",
      "combobox-list",
      "combobox-item",
      "combobox-group",
      "combobox-label",
      "combobox-empty",
      "combobox-separator",
      "combobox-chips",
      "combobox-chip",
      "combobox-chip-input",
    ]) {
      const marker = `data-slot="${slot}"`;
      const at = source.indexOf(marker);
      expect(source.indexOf("{...props}", at), slot).toBeGreaterThan(at);
    }
  });

  it("starts with the use client directive and keeps the facade directive-free", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(facade.trimStart().startsWith("export") || facade.trimStart().startsWith("//")).toBe(true);
    expect(facade).not.toContain("use client");
    expect(facade).toContain("export { Combobox, useComboboxAnchor }");
    expect(facade).not.toContain("export * from");
  });
});
