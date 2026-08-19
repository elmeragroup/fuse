import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { focusRing } from "../../styles/utils";
import { buttonVariants } from "./button-variants";

const here = dirname(fileURLToPath(import.meta.url));
const focusSelf = focusRing({ target: "self" }).root();

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "success", "link"] as const;
const SIZES = ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-inline", "icon-lg"] as const;

describe("buttonVariants", () => {
  it("defaults to the default variant and size", () => {
    const classes = buttonVariants();
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
    expect(classes).toContain("h-9");
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
    expect(buttonVariants({ size: "default" })).toContain("has-data-[icon=inline-start]:pl-2");
    expect(buttonVariants({ size: "xs" })).toContain("h-6");
    expect(buttonVariants({ size: "xs" })).toContain("rounded-[min(var(--radius-md),8px)]");
    expect(buttonVariants({ size: "sm" })).toContain("h-8");
    expect(buttonVariants({ size: "sm" })).toContain("rounded-[min(var(--radius-md),10px)]");
    expect(buttonVariants({ size: "lg" })).toContain("h-10");
    expect(buttonVariants({ size: "icon" })).toContain("size-9");
    expect(buttonVariants({ size: "icon-xs" })).toContain("size-6");
    expect(buttonVariants({ size: "icon-sm" })).toContain("size-8");
    expect(buttonVariants({ size: "icon-inline" })).toContain("hit-area-1");
    expect(buttonVariants({ size: "icon-lg" })).toContain("size-10");
  });

  it("composes the shared self focus ring and keeps invalid rings on error tokens", () => {
    const classes = buttonVariants();
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(classes).toContain(token);
    }
    expect(classes).toContain("aria-invalid:border-error");
    expect(classes).toContain("aria-invalid:ring-error/20");
    expect(classes.includes(["focus-visible", "ring-3"].join(":"))).toBe(false);
  });

  it("covers every public variant and size value", () => {
    expect(VARIANTS).toHaveLength(7);
    expect(SIZES).toHaveLength(9);
    for (const variant of VARIANTS) {
      expect(buttonVariants({ variant }).length).toBeGreaterThan(0);
    }
    for (const size of SIZES) {
      expect(buttonVariants({ size }).length).toBeGreaterThan(0);
    }
  });
});

describe("button source contract", () => {
  it("ships every spec §10 demo as a runnable file", () => {
    for (const demo of [
      "button-variant-matrix.tsx",
      "button-sizes.tsx",
      "button-pending.tsx",
      "button-visually-disabled.tsx",
      "button-predictive-intent.tsx",
    ]) {
      expect(existsSync(join(here, "demos", demo)), demo).toBe(true);
    }
  });

  it("does not keep destructive classes, dark variants, or the lifted local focus ring", () => {
    const source = [
      readFileSync(join(here, "button.tsx"), "utf8"),
      readFileSync(join(here, "button-variants.ts"), "utf8"),
    ].join("\n");

    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("Loader2");
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toContain("dark:");
    expect(source.includes(["focus-visible", "ring-3"].join(":"))).toBe(false);
    expect(source.includes(["focus-visible", "ring-ring"].join(":"))).toBe(false);
    expect(source).toContain('focusRing({ target: "self" })');
  });
});
