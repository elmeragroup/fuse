import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { typographyFragments } from "../../styles/typography-fragments";
import { textVariants } from "./text-variants";

const FRAGMENT_VARIANTS = [
  "default",
  "foreground",
  "primary",
  "secondary",
  "brand",
  "muted",
  "inherit",
  "destructive",
] as const;

const SIZES = ["xs", "sm", "default", "lg", "xl", "2xl"] as const;
const SIZE_TOKEN = {
  xs: "xs",
  sm: "sm",
  default: "base",
  lg: "lg",
  xl: "xl",
  "2xl": "2xl",
} as const;

describe("textVariants", () => {
  it("defaults to variant/size default, leading relaxed, and weight normal", () => {
    const resolved = textVariants();
    expect(resolved).toContain("font-sans");
    expect(resolved).toContain("text-inherit");
    expect(resolved).toContain("text-base");
    expect(resolved).toContain("leading-relaxed");
    expect(resolved).toContain("font-normal");
  });

  it.each(FRAGMENT_VARIANTS)("resolves variant %s onto the shared fragment class", (variant) => {
    const resolved = textVariants({ variant });
    // Oracle: the shared fragment, which typography-fragments.test.ts pins by hand.
    expect(resolved.split(/\s+/)).toContain(typographyFragments({ variant }));
    expect(resolved, variant).not.toContain("dark:");
    expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
  });

  it("adds a success variant on the success role token", () => {
    expect(textVariants({ variant: "success" }).split(/\s+/)).toContain("text-success");
  });

  it("renames destructive onto the error token and keeps the value name", () => {
    const resolved = textVariants({ variant: "destructive" });
    expect(resolved.split(/\s+/)).toContain("text-error");
    expect(resolved).not.toContain("text-destructive");
    expect(resolved).not.toContain("destructive");
  });

  it("resolves success onto text-success", () => {
    expect(textVariants({ variant: "success" }).split(/\s+/)).toContain("text-success");
  });

  it("cascades each type-scale size onto the host and descendants", () => {
    for (const size of SIZES) {
      const token = SIZE_TOKEN[size];
      const resolved = textVariants({ size });
      expect(resolved, size).toContain(`text-${token}`);
      expect(resolved, size).toContain(`*:text-${token}`);
      expect(resolved, size).toContain(`**:text-${token}`);
      expect(resolved, size).not.toContain("--control-");
      expect(resolved, size).not.toContain("data-density");
    }
    expect(textVariants({ size: "sm" })).toContain("text-sm");
    expect(textVariants({ size: "sm" })).toContain("*:text-sm");
    expect(textVariants({ size: "sm" })).toContain("**:text-sm");
  });

  it("maps weight bold onto font-medium, matching the ref cap", () => {
    expect(textVariants({ weight: "bold" }).split(/\s+/)).toContain("font-medium");
    expect(textVariants({ weight: "bold" })).not.toContain("font-bold");
    expect(textVariants({ weight: "medium" }).split(/\s+/)).toContain("font-medium");
    expect(textVariants({ weight: "normal" }).split(/\s+/)).toContain("font-normal");
  });

  it("defaults leading to leading-relaxed and covers the ladder", () => {
    expect(textVariants().split(/\s+/)).toContain("leading-relaxed");
    expect(textVariants({ leading: "none" }).split(/\s+/)).toContain("leading-none");
    expect(textVariants({ leading: "tight" }).split(/\s+/)).toContain("leading-tight");
    expect(textVariants({ leading: "snug" }).split(/\s+/)).toContain("leading-snug");
    expect(textVariants({ leading: "loose" }).split(/\s+/)).toContain("leading-loose");
  });

  it("adds truncate when the boolean axis is true", () => {
    expect(textVariants({ truncate: true }).split(/\s+/)).toContain("truncate");
    expect(textVariants().split(/\s+/)).not.toContain("truncate");
  });

  it("surfaces align as a first-class axis", () => {
    expect(textVariants({ align: "left" }).split(/\s+/)).toContain("text-left");
    expect(textVariants({ align: "center" }).split(/\s+/)).toContain("text-center");
    expect(textVariants({ align: "right" }).split(/\s+/)).toContain("text-right");
    expect(textVariants({ align: "justify" }).split(/\s+/)).toContain("text-justify");
    expect(textVariants().split(/\s+/)).not.toContain("text-left");
  });

  it("lets a className merge win over a conflicting recipe class through cn", () => {
    const merged = cn(
      textVariants({ variant: "primary", size: "lg" }),
      "text-sm text-muted-foreground"
    ).split(/\s+/);
    expect(merged).toContain("text-muted-foreground");
    expect(merged).not.toContain("text-primary");
    expect(merged).toContain("text-sm");
    expect(merged).not.toContain("text-lg");
  });
});
