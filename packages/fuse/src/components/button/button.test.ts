import { describe, expect, it } from "vitest";

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

  it("covers every public variant and size value", () => {
    for (const variant of VARIANTS) {
      expect(buttonVariants({ variant }).length).toBeGreaterThan(0);
    }
    for (const size of SIZES) {
      expect(buttonVariants({ size }).length).toBeGreaterThan(0);
    }
  });
});
