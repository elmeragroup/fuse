import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { typographyFragments } from "../../styles/typography-fragments";
import { textVariants } from "../text/text-variants";
import { spanVariants } from "./span-variants";

const VARIANTS = [
  "default",
  "foreground",
  "primary",
  "secondary",
  "brand",
  "muted",
  "inherit",
  "destructive",
  "success",
] as const;

function expectedVariantClass(variant: (typeof VARIANTS)[number]): string {
  return variant === "success" ? "text-success" : typographyFragments({ variant });
}

const SIZES = ["xs", "sm", "default", "lg", "xl", "2xl"] as const;
const SIZE_TOKEN = {
  xs: "xs",
  sm: "sm",
  default: "base",
  lg: "lg",
  xl: "xl",
  "2xl": "2xl",
} as const;

describe("spanVariants", () => {
  it("defaults to variant/size default, leading snug, and weight normal", () => {
    const resolved = spanVariants();
    expect(resolved).toBe(
      spanVariants({ variant: "default", size: "default", leading: "snug", weight: "normal" })
    );
    expect(resolved).toContain("font-sans");
    expect(resolved).toContain("text-inherit");
    expect(resolved).toContain("text-base");
    expect(resolved).toContain("leading-snug");
    expect(resolved).toContain("font-normal");
    expect(resolved).not.toContain("leading-relaxed");
  });

  it("tightens the inherited leading default versus textVariants", () => {
    expect(textVariants().split(/\s+/)).toContain("leading-relaxed");
    expect(spanVariants().split(/\s+/)).toContain("leading-snug");
    expect(spanVariants().split(/\s+/)).not.toContain("leading-relaxed");
  });

  it.each(VARIANTS)("resolves variant %s onto its token class", (variant) => {
    const resolved = spanVariants({ variant });
    expect(resolved.split(/\s+/)).toContain(expectedVariantClass(variant));
    expect(resolved, variant).not.toContain("dark:");
    expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
  });

  it("renames destructive onto the error token and keeps the value name", () => {
    const resolved = spanVariants({ variant: "destructive" });
    expect(resolved.split(/\s+/)).toContain("text-error");
    expect(resolved).not.toContain("text-destructive");
    expect(resolved).not.toContain("destructive");
  });

  it("cascades each type-scale size onto the host and descendants", () => {
    for (const size of SIZES) {
      const token = SIZE_TOKEN[size];
      const resolved = spanVariants({ size });
      expect(resolved, size).toContain(`text-${token}`);
      expect(resolved, size).toContain(`*:text-${token}`);
      expect(resolved, size).toContain(`**:text-${token}`);
      expect(resolved, size).not.toContain("--control-");
      expect(resolved, size).not.toContain("data-density");
    }
    const xs = spanVariants({ size: "xs" });
    expect(xs).toContain("text-xs");
    expect(xs).toContain("*:text-xs");
    expect(xs).toContain("**:text-xs");
  });

  it("maps weight bold onto font-medium, matching the inherited cap", () => {
    expect(spanVariants({ weight: "bold" }).split(/\s+/)).toContain("font-medium");
    expect(spanVariants({ weight: "bold" })).not.toContain("font-bold");
    expect(spanVariants({ weight: "medium" }).split(/\s+/)).toContain("font-medium");
    expect(spanVariants({ weight: "normal" }).split(/\s+/)).toContain("font-normal");
  });

  it("covers the inherited leading ladder", () => {
    expect(spanVariants({ leading: "none" }).split(/\s+/)).toContain("leading-none");
    expect(spanVariants({ leading: "tight" }).split(/\s+/)).toContain("leading-tight");
    expect(spanVariants({ leading: "relaxed" }).split(/\s+/)).toContain("leading-relaxed");
    expect(spanVariants({ leading: "loose" }).split(/\s+/)).toContain("leading-loose");
  });

  it("adds truncate when the boolean axis is true", () => {
    expect(spanVariants({ truncate: true }).split(/\s+/)).toContain("truncate");
    expect(spanVariants().split(/\s+/)).not.toContain("truncate");
  });

  it("surfaces align as a first-class axis", () => {
    expect(spanVariants({ align: "left" }).split(/\s+/)).toContain(typographyFragments({ align: "left" }));
    expect(spanVariants({ align: "center" }).split(/\s+/)).toContain(
      typographyFragments({ align: "center" })
    );
    expect(spanVariants({ align: "right" }).split(/\s+/)).toContain(typographyFragments({ align: "right" }));
    expect(spanVariants({ align: "justify" }).split(/\s+/)).toContain("text-justify");
    expect(spanVariants().split(/\s+/)).not.toContain("text-left");
  });

  it("lets a className merge win over a conflicting recipe class through cn", () => {
    const merged = cn(
      spanVariants({ variant: "primary", size: "lg" }),
      "text-sm text-muted-foreground"
    ).split(/\s+/);
    expect(merged).toContain("text-muted-foreground");
    expect(merged).not.toContain("text-primary");
    expect(merged).toContain("text-sm");
    expect(merged).not.toContain("text-lg");
  });
});
