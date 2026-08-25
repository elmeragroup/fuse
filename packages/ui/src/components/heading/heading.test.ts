import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { headingVariants } from "./heading-variants";

const here = dirname(fileURLToPath(import.meta.url));

const VARIANTS = [
  "default",
  "foreground",
  "primary",
  "secondary",
  "brand",
  "muted",
  "inherit",
  "destructive",
] as const;

const VARIANT_CLASS = {
  default: "text-inherit",
  foreground: "text-foreground",
  primary: "text-primary",
  secondary: "text-secondary",
  brand: "text-brand",
  muted: "text-muted-foreground",
  inherit: "text-inherit",
  destructive: "text-error",
} as const;

const SIZES = ["default", "sm", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"] as const;

describe("headingVariants", () => {
  it("defaults to variant/size/font default", () => {
    const resolved = headingVariants();
    expect(resolved).toBe(headingVariants({ variant: "default", size: "default", font: "default" }));
    expect(resolved).toContain("font-heading");
    expect(resolved).toContain("text-inherit");
    expect(resolved).toContain("text-base");
    expect(resolved).toContain("leading-snug");
    expect(resolved).toContain("font-medium");
  });

  it("resolves each variant class; destructive is text-error and never a destructive class", () => {
    for (const variant of VARIANTS) {
      const resolved = headingVariants({ variant });
      expect(resolved, variant).toContain(VARIANT_CLASS[variant]);
      expect(resolved, variant).not.toContain("dark:");
      expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
    }
    const destructive = headingVariants({ variant: "destructive" });
    expect(destructive).toContain("text-error");
    expect(destructive).not.toContain("destructive");
    expect(VARIANTS).toHaveLength(8);
  });

  it("resolves each type-scale size without density control metrics", () => {
    expect(headingVariants({ size: "default" })).toContain("text-base");
    expect(headingVariants({ size: "sm" })).toContain("text-sm");
    expect(headingVariants({ size: "lg" })).toContain("text-lg");
    expect(headingVariants({ size: "xl" })).toContain("text-xl");
    expect(headingVariants({ size: "2xl" })).toContain("text-2xl");
    expect(headingVariants({ size: "3xl" })).toContain("text-3xl");
    expect(headingVariants({ size: "4xl" })).toContain("text-4xl");
    expect(headingVariants({ size: "5xl" })).toContain("text-5xl");
    expect(headingVariants({ size: "6xl" })).toContain("text-6xl");
    expect(headingVariants({ size: "6xl" })).toContain("leading-tight");
    for (const size of SIZES) {
      if (size !== "6xl") {
        expect(headingVariants({ size }), size).toContain("leading-snug");
      }
      expect(headingVariants({ size }), size).not.toContain("--control-");
    }
    expect(SIZES).toHaveLength(9);
  });

  it("toggles noMargin, uppercase, and align", () => {
    expect(headingVariants({ noMargin: true })).toContain("mb-0");
    expect(headingVariants({ uppercase: true })).toContain("uppercase");
    expect(headingVariants({ align: "left" })).toContain("text-left");
    expect(headingVariants({ align: "center" })).toContain("text-center");
    expect(headingVariants({ align: "right" })).toContain("text-right");
  });

  it("lets a className merge win over a conflicting recipe class through cn", () => {
    const merged = cn(headingVariants({ variant: "muted" }), "text-primary").split(/\s+/);
    expect(merged).toContain("text-primary");
    expect(merged).not.toContain("text-muted-foreground");
  });
});

describe("heading source contract", () => {
  it("is a client useRender surface with no RAC import and no slot prop", () => {
    const source = [
      readFileSync(join(here, "heading.tsx"), "utf8"),
      readFileSync(join(here, "heading-variants.ts"), "utf8"),
    ].join("\n");
    expect(source).toContain('"use client"');
    expect(source).toContain("useRender");
    expect(source).toContain("mergeProps");
    expect(source).toContain('slot: "heading"');
    expect(source).not.toContain("react-aria-components");
    expect(source).not.toContain('from "react-aria"');
    expect(source).not.toContain("ReactAriaHeading");
    expect(source).not.toMatch(/\bslot,/);
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(/text-destructive|bg-destructive|border-destructive/);
    expect(source).toContain("text-error");
  });

  it("exports the recipe publicly from the heading entry", () => {
    const facade = readFileSync(join(here, "..", "..", "heading.ts"), "utf8");
    expect(facade).toContain('export { headingVariants } from "./components/heading/heading-variants";');
    expect(facade).toContain('export { Heading } from "./components/heading/heading";');
  });
});
