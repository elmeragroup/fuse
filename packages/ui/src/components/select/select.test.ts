import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "select.tsx"), "utf8");
const facade = readFileSync(join(here, "../../select.ts"), "utf8");
const overlayClassesSource = readFileSync(join(here, "../overlay/overlay-classes.ts"), "utf8");

describe("select source contract", () => {
  it("declares the overlay layer once on the Positioner and never falls back to document.body", () => {
    // Source-grep: a single z-50 declaration (select.md §8.7) and the absence of a
    // body fallback (theming.md §7.4) have no consumer-behavior probe of their own.
    // The layer lives in the shared overlay module; this file borrows overlayLayer
    // and must not stamp a second z-50 on the Popup.
    expect(overlayClassesSource.match(/z-50/gu)).toHaveLength(1);
    expect(source).not.toContain("z-50");
    expect(source).toContain("overlayLayer");
    expect(source).toContain("isolate");
    expect(source).not.toContain("document.body");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("inverted:");
  });

  it("reads density rungs on the trigger size axis and uses bg-card", () => {
    expect(source).toContain('size = "default"');
    expect(source).toContain("data-[size=default]:h-(--control-h-md)");
    expect(source).toContain("data-[size=sm]:h-(--control-h-sm)");
    expect(source).not.toMatch(/data-\[size=(?:default|sm)\]:h-\d/);
    expect(source).toContain("bg-card");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("bg-white");
    expect(source).toContain("aria-invalid:border-error");
    expect(source).toContain("aria-invalid:ring-3");
    expect(source).toContain("aria-invalid:ring-error/20");
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
  });

  it("composes the shared self focus ring and drops the dead data-variant selector", () => {
    expect(source).toContain("selfFocusRing");
    expect(source).toContain('focusRing({ target: "self" })');
    expect(source).not.toContain("data-variant");
    expect(source).not.toContain("not-data-[variant=destructive]");
    expect(source).toContain("focus:**:text-accent-foreground");
    expect(source).not.toMatch(RAW_PALETTE_RE);
  });

  it("keeps the lifted popup metrics, align-trigger default, and Phosphor icons", () => {
    expect(source).toContain("alignItemWithTrigger = true");
    expect(source).toContain('data-align-trigger={alignItemWithTrigger ? "true" : "false"}');
    expect(source).toContain("data-[align-trigger=true]:animate-none");
    expect(source).toContain("min-w-36");
    expect(source).toContain("max-h-(--available-height)");
    expect(source).toContain("w-(--anchor-width)");
    expect(source).toContain("*:[span]:last:flex");
    expect(source).toContain("Check");
    expect(source).toContain("CaretDown");
    expect(source).toContain("CaretUp");
    expect(source).not.toContain("CheckIcon");
    expect(source).not.toContain("Chevron");
    expect(source).not.toContain("lucide");
  });

  it("emits data-slot before the props spread on every rendering part", () => {
    for (const slot of [
      "select-trigger",
      "select-value",
      "select-content",
      "select-item",
      "select-group",
      "select-label",
      "select-separator",
      "select-scroll-up-button",
      "select-scroll-down-button",
    ]) {
      expect(source, slot).toContain(`data-slot="${slot}"`);
    }
    expect(source).not.toContain('data-slot="select"');
    for (const part of source.split("function ").slice(1)) {
      const slot = part.indexOf("data-slot=");
      const spread = part.indexOf("{...props}");
      if (slot === -1 || spread === -1) {
        continue;
      }
      expect(slot).toBeLessThan(spread);
    }
  });

  it("starts with the use client directive and keeps the facade directive-free", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(facade.trimStart().startsWith("export") || facade.trimStart().startsWith("//")).toBe(true);
    expect(facade).not.toContain("use client");
    expect(facade).toContain("export { Select }");
  });
});
