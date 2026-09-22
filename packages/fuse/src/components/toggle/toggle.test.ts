import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { toggleVariants } from "./toggle-variants";
import { selfFocusRingClass } from "../../styles/utils";

const VARIANTS = ["default", "outline"] as const;
const SIZES = ["xs", "sm", "default", "lg"] as const;
const SIZE_TO_RUNG = {
  xs: "xs",
  sm: "sm",
  default: "md",
  lg: "lg",
} as const;

describe("toggleVariants", () => {
  it("defaults to variant=default and size=default", () => {
    const resolved = toggleVariants();
    expect(resolved).toContain("bg-transparent");
    expect(resolved).toContain("h-(--control-h-md)");
    expect(resolved).toContain("gap-(--control-gap-md)");
    expect(resolved.split(/\s+/).length).toBeGreaterThan(1);
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
    expect(outline).toContain("hover:bg-muted");
  });

  it("reads the matching --control-h-* variable on every size, never a literal h-*", () => {
    for (const size of SIZES) {
      const rung = SIZE_TO_RUNG[size];
      const resolved = toggleVariants({ size });
      expect(resolved, size).toContain(`h-(--control-h-${rung})`);
      expect(resolved, size).toContain(`min-w-(--control-h-${rung})`);
      expect(resolved, size).toContain(`gap-(--control-gap-${rung})`);
      expect(resolved, size).toContain(`px-(--control-px-${rung})`);
      expect(resolved, size).not.toMatch(/(?:^|\s)h-\d/);
      expect(resolved, size).not.toMatch(/(?:^|\s)min-w-\d/);
      expect(resolved, size).not.toMatch(/(?:^|\s)gap-\d/);
      expect(resolved, size).not.toMatch(/(?:^|\s)px-\d/);
      for (const other of SIZES) {
        if (other === size) {
          continue;
        }
        expect(resolved, size).not.toContain(`h-(--control-h-${SIZE_TO_RUNG[other]})`);
      }
    }
  });

  it("keeps icon-padding hooks, size-owned type, and the control-type pair on the mapped rungs", () => {
    const xs = toggleVariants({ size: "xs" });
    expect(xs).toContain("text-xs");
    expect(xs).toContain("rounded-[min(var(--radius-md),10px)]");
    expect(xs).toContain("has-data-[icon=inline-start]:pl-(--control-px-icon-xs)");
    expect(xs).toContain("has-data-[icon=inline-end]:pr-(--control-px-icon-xs)");
    expect(xs).toContain("[&_svg:not([class*='size-'])]:size-3");
    expect(xs).not.toContain("[font-size:var(--control-text)]");

    const sm = toggleVariants({ size: "sm" });
    expect(sm).toContain("text-sm");
    expect(sm).toContain("has-data-[icon=inline-start]:pl-(--control-px-icon-sm)");
    expect(sm).toContain("has-data-[icon=inline-end]:pr-(--control-px-icon-sm)");
    expect(sm).not.toContain("[font-size:var(--control-text)]");

    const defaults = toggleVariants({ size: "default" });
    expect(defaults).toContain("has-data-[icon=inline-start]:pl-(--control-px-icon-md)");
    expect(defaults).toContain("has-data-[icon=inline-end]:pr-(--control-px-icon-md)");
    expect(defaults).toContain("[font-size:var(--control-text)]");
    expect(defaults).toContain("[line-height:var(--control-leading)]");

    const lg = toggleVariants({ size: "lg" });
    expect(lg).toContain("has-data-[icon=inline-start]:pl-(--control-px-icon-lg)");
    expect(lg).toContain("has-data-[icon=inline-end]:pr-(--control-px-icon-lg)");
    expect(lg).toContain("[font-size:var(--control-text)]");
    expect(lg).toContain("[line-height:var(--control-leading)]");
  });

  it("keeps the doubled pressed selectors and composes the shared self focus ring", () => {
    const classes = toggleVariants();
    expect(classes).toContain("aria-pressed:bg-muted");
    expect(classes).toContain("data-pressed:bg-muted");
    // Oracle: the shared focus recipe, which utils.test.ts pins by hand.
    for (const token of selfFocusRingClass.split(" ")) {
      expect(classes).toContain(token);
    }
    expect(classes).toContain("aria-invalid:border-error");
    expect(classes).toContain("aria-invalid:ring-error/20");
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
