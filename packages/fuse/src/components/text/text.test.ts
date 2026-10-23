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
  it("defaults to variant/size default, the base paragraph leading role, and weight normal", () => {
    const classes = textVariants().split(/\s+/);
    expect(classes).toContain("font-sans");
    expect(classes).toContain("text-inherit");
    expect(classes).toContain("text-base");
    expect(classes).toContain("leading-(--paragraph-leading-base,1.625rem)");
    expect(classes).not.toContain("leading-relaxed");
    expect(classes).toContain("font-normal");
  });

  describe("default line height per size", () => {
    it.each([
      ["sm", "leading-(--paragraph-leading-sm,1.421875rem)"],
      ["default", "leading-(--paragraph-leading-base,1.625rem)"],
      ["lg", "leading-(--paragraph-leading-lg,1.828125rem)"],
      ["xs", "leading-relaxed"],
      ["xl", "leading-relaxed"],
      ["2xl", "leading-relaxed"],
    ] as const)("sets size %s's line height with %s", (size, leading) => {
      // The resolved string keeps the leading class only when it follows the arm's
      // text-<size>: tailwind-merge drops a leading class that a later font size follows.
      const leadingClasses = textVariants({ size })
        .split(/\s+/)
        .filter((name) => name.startsWith("leading-"));
      expect(leadingClasses).toEqual([leading]);
    });

    it.each(SIZES)("lets an explicit leading replace size %s's default", (size) => {
      const leadingClasses = textVariants({ size, leading: "snug" })
        .split(/\s+/)
        .filter((name) => name.startsWith("leading-"));
      expect(leadingClasses).toEqual(["leading-snug"]);
    });

    it("lets a className leading replace the role", () => {
      const leadingClasses = textVariants({ size: "lg", className: "leading-tight" })
        .split(/\s+/)
        .filter((name) => name.startsWith("leading-"));
      expect(leadingClasses).toEqual(["leading-tight"]);
    });

    it("drops the role when a className sets the size", () => {
      const classes = textVariants({ className: "text-lg" }).split(/\s+/);
      expect(classes.filter((name) => name.startsWith("leading-"))).toEqual([]);
    });
  });

  it.each(FRAGMENT_VARIANTS)("resolves variant %s onto the shared fragment class", (variant) => {
    const resolved = textVariants({ variant });
    // Oracle: the shared fragment, which typography-fragments.test.ts pins by hand.
    expect(resolved.split(/\s+/)).toContain(typographyFragments({ variant }));
    expect(resolved, variant).not.toContain("dark:");
    expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
  });

  it("sizes the host with the full size class and descendants with font size alone", () => {
    for (const size of SIZES) {
      const token = SIZE_TOKEN[size];
      const classes = textVariants({ size }).split(/\s+/);
      expect(classes, size).toContain(`text-${token}`);
      expect(classes, size).toContain(`*:text-(length:--text-${token})`);
      expect(classes, size).toContain(`**:text-(length:--text-${token})`);
      // The plain descendant form would also reset each descendant's line height.
      expect(classes, size).not.toContain(`*:text-${token}`);
      expect(classes, size).not.toContain(`**:text-${token}`);
      expect(classes.join(" "), size).not.toContain("--control-");
      expect(classes.join(" "), size).not.toContain("data-density");
    }
  });

  it.each([
    ["a child size", "*:text-lg", "*:text-(length:--text-base)"],
    ["a descendant size", "**:text-sm", "**:text-(length:--text-base)"],
    ["the host size", "text-lg", "text-base"],
  ])("lets a className replace %s", (_row, className, replaced) => {
    const classes = textVariants({ className }).split(/\s+/);
    expect(classes).toContain(className);
    expect(classes).not.toContain(replaced);
  });

  it.each<
    [string, Parameters<typeof textVariants>[0], { has?: string; lacksToken?: string; lacksText?: string }]
  >([
    // weight bold is capped at font-medium, matching the ref
    ["weight bold", { weight: "bold" }, { has: "font-medium", lacksText: "font-bold" }],
    ["weight medium", { weight: "medium" }, { has: "font-medium" }],
    ["weight normal", { weight: "normal" }, { has: "font-normal" }],
    ["leading relaxed", { leading: "relaxed" }, { has: "leading-relaxed" }],
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
