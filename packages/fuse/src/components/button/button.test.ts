import { describe, expect, it } from "vitest";

import { buttonVariants } from "./button-variants";

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "success", "link"] as const;
const SIZES = ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-inline", "icon-lg"] as const;

describe("buttonVariants", () => {
  it("defaults to the default variant", () => {
    const classes = buttonVariants();
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
  });

  // The size axis is measured, not string-matched: control-size.browser.test.tsx checks
  // every size's computed box and type against DENSITY_METRICS at both densities.
  it("covers every public variant and size value without density variants", () => {
    for (const variant of VARIANTS) {
      expect(buttonVariants({ variant }).length).toBeGreaterThan(0);
    }
    for (const size of SIZES) {
      const classes = buttonVariants({ size });
      expect(classes.length).toBeGreaterThan(0);
      expect(classes, size).not.toMatch(/\b(?:dense|comfortable):/);
    }
  });
});
