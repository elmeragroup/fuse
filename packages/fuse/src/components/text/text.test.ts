import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
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

  it.each<
    [string, Parameters<typeof textVariants>[0], { has?: string; lacksToken?: string; lacksText?: string }]
  >([
    // weight bold is capped at font-medium, matching the ref
    ["weight bold", { weight: "bold" }, { has: "font-medium", lacksText: "font-bold" }],
    ["weight medium", { weight: "medium" }, { has: "font-medium" }],
    ["weight normal", { weight: "normal" }, { has: "font-normal" }],
    ["default leading", undefined, { has: "leading-relaxed" }],
    ["leading none", { leading: "none" }, { has: "leading-none" }],
    ["leading tight", { leading: "tight" }, { has: "leading-tight" }],
    ["leading snug", { leading: "snug" }, { has: "leading-snug" }],
    ["leading loose", { leading: "loose" }, { has: "leading-loose" }],
    ["truncate", { truncate: true }, { has: "truncate" }],
    ["no truncate by default", undefined, { lacksToken: "truncate" }],
    ["align left", { align: "left" }, { has: "text-left" }],
    ["align center", { align: "center" }, { has: "text-center" }],
    ["align right", { align: "right" }, { has: "text-right" }],
    ["align justify", { align: "justify" }, { has: "text-justify" }],
    ["no align by default", undefined, { lacksToken: "text-left" }],
  ])(
    "resolves %s on the weight, leading, truncate, and align axes",
    (_row, props, { has, lacksToken, lacksText }) => {
      const resolved = textVariants(props);
      if (has !== undefined) expect(resolved.split(/\s+/)).toContain(has);
      if (lacksToken !== undefined) expect(resolved.split(/\s+/)).not.toContain(lacksToken);
      if (lacksText !== undefined) expect(resolved).not.toContain(lacksText);
    }
  );
});
