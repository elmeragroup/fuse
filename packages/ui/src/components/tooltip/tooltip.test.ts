import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "tooltip.tsx"), "utf8");
const overlayClassesSource = readFileSync(join(here, "../overlay/overlay-classes.ts"), "utf8");

describe("tooltip source contract", () => {
  it("declares the overlay layer once on the Positioner and never falls back to document.body", () => {
    // Source-grep: a single z-50 declaration (tooltip.md §8.7) and the absence of a
    // body fallback (theming.md §7.4) have no consumer-behavior probe of their own.
    // The layer lives in the shared overlay module; tooltip.tsx borrows overlayLayer
    // and must not stamp a second z-50 on the Popup or Arrow.
    expect(overlayClassesSource.match(/z-50/gu)).toHaveLength(1);
    expect(source).not.toContain("z-50");
    expect(source).toContain("overlayLayer");
    expect(source).toContain("isolate");
    expect(source).not.toContain("document.body");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
  });

  it("drops the dead Radix delayed-open selectors and the phantom kbd hooks", () => {
    expect(source).not.toContain("data-[state=delayed-open]");
    expect(source).not.toContain("delayed-open");
    expect(source).not.toContain("has-data-[slot=kbd]");
    expect(source).not.toContain("data-[slot=kbd]");
    expect(source).not.toContain("showArrow");
  });

  it("keeps the inverted pill, always-rendered arrow, and Provider delay default", () => {
    expect(source).toContain("delay = 0");
    expect(source).toContain("bg-foreground");
    expect(source).toContain("text-background");
    expect(source).toContain("text-xs");
    expect(source).toContain("max-w-xs");
    expect(source).toContain("px-3");
    expect(source).toContain("py-1.5");
    expect(source).toContain('side = "top"');
    expect(source).toContain("TooltipPrimitive.Arrow");
    expect(source).toContain('role="tooltip"');
    expect(source).toContain("rounded-[2px]");
    expect(source).toContain("translate-y-[calc(-50%-2px)]");
    expect(source).toContain("fill-foreground");
    expect(source).not.toContain("shadow-md");
    expect(source).not.toContain("ring-1");
  });

  it("does not export Portal, Positioner, or Popup parts", () => {
    expect(source).toContain("TooltipPrimitive.Portal");
    expect(source).toContain("TooltipPrimitive.Positioner");
    expect(source).toContain("TooltipPrimitive.Popup");
    expect(source).not.toContain("Portal:");
    expect(source).not.toContain("Positioner:");
    expect(source).not.toContain("Popup:");
  });

  it("documents that per-tooltip delay opts out of the outer Provider group", () => {
    expect(source).toContain("nested scoped Provider");
    expect(source).toContain("skip-delay hand-off");
  });

  it("emits data-slot before the props spread on every rendering part", () => {
    for (const slot of ["tooltip-provider", "tooltip", "tooltip-trigger", "tooltip-content"]) {
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
