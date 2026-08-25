import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "popover.tsx"), "utf8");

describe("popover source contract", () => {
  it("declares the overlay layer once on the Positioner and never falls back to document.body", () => {
    // Source-grep: a single z-50 (popover.md §8.4) and the absence of a body fallback
    // (theming.md §7.4) have no consumer-behavior probe of their own.
    expect(source.match(/z-50/gu)).toHaveLength(1);
    expect(source).toContain('className="isolate z-50"');
    expect(source).not.toContain("document.body");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).toContain("before:bg-popover");
    expect(source).toContain("before:border-border");
    expect(source).toContain("sqrt(2)");
    expect(source).not.toContain("react-aria/internal/popover");
  });

  it("keeps the lifted popup metrics, elevation, and animation timing", () => {
    expect(source).toContain("w-72");
    expect(source).toContain("p-4");
    expect(source).toContain("gap-4");
    expect(source).toContain("shadow-md");
    expect(source).toContain("ring-1 ring-foreground/10");
    expect(source).toContain("duration-100");
    expect(source).toContain("showArrow = false");
  });

  it("does not export Portal, Positioner, or Popup parts", () => {
    expect(source).toContain("PopoverPrimitive.Portal");
    expect(source).toContain("PopoverPrimitive.Positioner");
    expect(source).toContain("PopoverPrimitive.Popup");
    expect(source).not.toContain("Portal:");
    expect(source).not.toContain("Positioner:");
    expect(source).not.toContain("Popup:");
  });

  it("emits data-slot before the props spread on every rendering part", () => {
    for (const slot of [
      "popover",
      "popover-trigger",
      "popover-content",
      "popover-header",
      "popover-title",
      "popover-description",
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

  it("starts with the use client directive", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });
});
