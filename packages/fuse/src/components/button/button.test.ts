import { describe, expect, it } from "vitest";

import { selfFocusRingClass } from "../../styles/utils";
import { buttonVariants } from "./button-variants";

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "success", "link"] as const;
const SIZES = ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-inline", "icon-lg"] as const;

describe("buttonVariants", () => {
  it("defaults to the default variant and size", () => {
    const classes = buttonVariants();
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
    expect(classes).toContain("h-(--control-h-md)");
    expect(classes.split(/\s+/).length).toBeGreaterThan(1);
  });

  it("renders each variant recipe", () => {
    expect(buttonVariants({ variant: "default" })).toContain("hover:bg-primary/80");
    expect(buttonVariants({ variant: "outline" })).toContain("border-border");
    expect(buttonVariants({ variant: "outline" })).toContain("aria-expanded:bg-muted");
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-secondary");
    expect(buttonVariants({ variant: "ghost" })).toContain("hover:bg-muted");
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-error/10");
    expect(buttonVariants({ variant: "destructive" })).toContain("text-error");
    expect(buttonVariants({ variant: "success" })).toContain("bg-success/10");
    expect(buttonVariants({ variant: "success" })).toContain("text-success");
    expect(buttonVariants({ variant: "link" })).toContain("underline-offset-4");
  });

  it("renders each size recipe and icon-padding hooks", () => {
    const defaults = buttonVariants({ size: "default" });
    expect(defaults).toContain("h-(--control-h-md)");
    expect(defaults).toContain("gap-(--control-gap-md)");
    expect(defaults).toContain("px-(--control-px-md)");
    expect(defaults).toContain("has-data-[icon=inline-start]:pl-(--control-px-icon-md)");
    expect(defaults).toContain("has-data-[icon=inline-end]:pr-(--control-px-icon-md)");
    expect(defaults).toContain("[font-size:var(--control-text)]");
    expect(defaults).toContain("[line-height:var(--control-leading)]");
    expect(defaults).not.toContain("h-9");

    const xs = buttonVariants({ size: "xs" });
    expect(xs).toContain("h-(--control-h-xs)");
    expect(xs).toContain("text-xs");
    expect(xs).toContain("has-data-[icon=inline-start]:pl-(--control-px-icon-xs)");
    expect(xs).toContain("has-data-[icon=inline-end]:pr-(--control-px-icon-xs)");

    const sm = buttonVariants({ size: "sm" });
    expect(sm).toContain("h-(--control-h-sm)");
    expect(sm).toContain("text-sm");
    expect(sm).not.toContain("[font-size:var(--control-text)]");
    expect(sm).toContain("has-data-[icon=inline-start]:pl-(--control-px-icon-sm)");
    expect(sm).toContain("has-data-[icon=inline-end]:pr-(--control-px-icon-sm)");

    const lg = buttonVariants({ size: "lg" });
    expect(lg).toContain("h-(--control-h-lg)");
    expect(lg).toContain("[font-size:var(--control-text)]");
    expect(lg).toContain("[line-height:var(--control-leading)]");
    expect(lg).toContain("has-data-[icon=inline-start]:pl-(--control-px-icon-lg)");
    expect(lg).toContain("has-data-[icon=inline-end]:pr-(--control-px-icon-lg)");

    expect(buttonVariants({ size: "icon" })).toContain("size-(--control-h-md)");
    expect(buttonVariants({ size: "icon" })).not.toContain("h-(--control-h-md)");
    expect(buttonVariants({ size: "icon-xs" })).toContain("size-(--control-h-xs)");
    expect(buttonVariants({ size: "icon-sm" })).toContain("size-(--control-h-sm)");
    expect(buttonVariants({ size: "icon-inline" })).toContain("hit-area-1");
    expect(buttonVariants({ size: "icon-lg" })).toContain("size-(--control-h-lg)");
    expect(buttonVariants({ size: "default" })).not.toMatch(/\b(?:dense|comfortable):/);
  });

  it("composes the shared self focus ring and keeps invalid rings on error tokens", () => {
    const classes = buttonVariants();
    // Oracle: the shared focus recipe, which utils.test.ts pins by hand.
    for (const token of selfFocusRingClass.split(" ")) {
      expect(classes).toContain(token);
    }
    expect(classes).toContain("aria-invalid:border-error");
    expect(classes).toContain("aria-invalid:ring-error/20");
    expect(classes.includes(["focus-visible", "ring-3"].join(":"))).toBe(false);
  });

  it("covers every public variant and size value", () => {
    for (const variant of VARIANTS) {
      expect(buttonVariants({ variant }).length).toBeGreaterThan(0);
    }
    for (const size of SIZES) {
      expect(buttonVariants({ size }).length).toBeGreaterThan(0);
    }
  });
});
