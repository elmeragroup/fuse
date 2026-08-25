import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { typographyAlignClasses, typographyColorClasses } from "../../styles/typography-fragments";
import { textVariants } from "../text/text-variants";
import { spanVariants } from "./span-variants";

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
  "success",
] as const;

const VARIANT_CLASS = {
  ...typographyColorClasses,
  success: "text-success",
} as const;

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
    expect(resolved.split(/\s+/)).toContain(VARIANT_CLASS[variant]);
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
    expect(spanVariants({ align: "left" }).split(/\s+/)).toContain(typographyAlignClasses.left);
    expect(spanVariants({ align: "center" }).split(/\s+/)).toContain(typographyAlignClasses.center);
    expect(spanVariants({ align: "right" }).split(/\s+/)).toContain(typographyAlignClasses.right);
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

describe("span source contract", () => {
  it("is a client surface that does not import RAC", () => {
    const source = readFileSync(join(here, "span.tsx"), "utf8");
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).not.toContain("react-aria-components");
    expect(source).not.toContain("react-aria/");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).toContain("useRender");
    expect(source).toContain("mergeProps");
    expect(source).not.toContain("elementType");
  });

  it("emits data-slot=span before the props merge and drops the RAC slot prop", () => {
    const source = readFileSync(join(here, "span.tsx"), "utf8");
    const slotMarker = '"data-slot": "span"';
    expect(source).toContain(slotMarker);
    expect(source.indexOf(slotMarker)).toBeLessThan(source.indexOf("...mergeProps"));
    expect(source).not.toMatch(/(?:^|[^-\w])slot\s*[:=]/);
  });

  it("carries no destructive class name in library source", () => {
    const recipe = readFileSync(join(here, "span-variants.ts"), "utf8");
    const component = readFileSync(join(here, "span.tsx"), "utf8");
    for (const source of [recipe, component]) {
      expect(source).not.toContain("text-destructive");
      expect(source).not.toContain("bg-destructive");
      expect(source).not.toContain("text-error");
    }
    expect(recipe).toContain("extend: textVariants");
    expect(recipe).toContain('leading: "snug"');
  });

  it("exports the recipe publicly from the span entry as SpanProps", () => {
    const facade = readFileSync(join(here, "..", "..", "span.ts"), "utf8");
    expect(facade).toContain('export { spanVariants } from "./components/span/span-variants";');
    expect(facade).toContain('export { Span } from "./components/span/span";');
    expect(facade).toContain("export type { SpanProps }");
    expect(facade).not.toContain("TextProps");
  });
});
