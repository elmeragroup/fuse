import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { selfFocusRingClass } from "../../styles/utils";
import { toggleVariants } from "./toggle-variants";

const VARIANTS = ["default", "outline"] as const;
const SIZES = ["xs", "sm", "default", "lg"] as const;

describe("toggleVariants", () => {
  it("defaults to variant=default", () => {
    expect(toggleVariants()).toContain("bg-transparent");
  });

  it("renders each variant without leaking the other axis", () => {
    const defaults = toggleVariants({ variant: "default" });
    expect(defaults).toContain("bg-transparent");
    expect(defaults).not.toContain("border-input");
    expect(defaults).not.toContain("shadow-xs");

    const outline = toggleVariants({ variant: "outline" });
    expect(outline).toContain("border-input");
    expect(outline).toContain("bg-transparent");
    expect(outline).toContain("shadow-xs");
  });

  it("keeps the doubled pressed selectors and composes the shared self focus ring", () => {
    const classes = toggleVariants();
    expect(classes).toContain("aria-pressed:bg-muted");
    expect(classes).toContain("data-pressed:bg-muted");
    // Oracle: the shared focus recipe, which utils.test.ts pins by hand.
    for (const token of selfFocusRingClass.split(" ")) {
      expect(classes).toContain(token);
    }
    expect(classes.includes(["focus-visible", "ring-[3px]"].join(":"))).toBe(false);
    expect(classes.includes(["focus-visible", "ring-3"].join(":"))).toBe(false);
  });

  it("covers every public variant and size value without raw palette, dark, or density variants", () => {
    for (const variant of VARIANTS) {
      const resolved = toggleVariants({ variant });
      expect(resolved.length).toBeGreaterThan(0);
      expect(resolved, variant).not.toContain("dark:");
      expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
      expect(resolved, variant).not.toMatch(/\b(?:dense|comfortable):/);
    }
    for (const size of SIZES) {
      expect(toggleVariants({ size }).length).toBeGreaterThan(0);
    }
  });
});
