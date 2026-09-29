import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { badgeVariants } from "./badge-variants";

const VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "success",
  "warning",
  "info",
  "outline",
  "outline-secondary",
  "outline-destructive",
  "outline-success",
  "outline-warning",
  "muted",
  "accent",
  "card",
] as const;

describe("badgeVariants", () => {
  it("defaults to variant=default and size=default", () => {
    const resolved = badgeVariants();
    expect(resolved).toContain("bg-primary");
    expect(resolved).toContain("px-2.5");
    expect(resolved).toContain("py-0.5");
    expect(resolved).toContain("text-xs");
  });

  it("keeps the non-interactive base without focus styling", () => {
    const resolved = badgeVariants();
    expect(resolved).toContain("inline-flex");
    expect(resolved).toContain("items-center");
    // Radius derives from the brand `--radius` scale.
    expect(resolved).toContain("rounded-lg");
    expect(resolved).toContain("transition-colors");
    // The non-interactive badge has no bare `:focus` ring.
    expect(resolved).not.toContain("focus:");
    expect(resolved).not.toContain("focus-visible:");
    expect(resolved).not.toContain("ring-");
  });

  it("resolves all fourteen variants without raw palette, dark or hover classes", () => {
    for (const variant of VARIANTS) {
      const resolved = badgeVariants({ variant });
      expect(resolved, variant).not.toBe("");
      expect(resolved, variant).not.toContain("dark:");
      expect(resolved, variant).not.toContain("hover:");
      expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
    }
  });

  it.each([
    // The destructive-named variants rename onto the canonical error tokens.
    ["destructive", ["bg-error", "text-error-foreground"], ["destructive"]],
    ["outline-destructive", ["border-error", "text-error"], ["destructive"]],
    // info pairs its soft surface with its foreground.
    ["info", ["bg-info-soft", "border-info/20", "text-info-soft-foreground"], []],
    // outline keeps a bare border and foreground text.
    ["outline", ["text-foreground", "border"], ["bg-"]],
  ] as const)("maps variant=%s onto its token classes", (variant, present, absent) => {
    const resolved = badgeVariants({ variant });
    for (const token of present) {
      expect(resolved).toContain(token);
    }
    for (const token of absent) {
      expect(resolved).not.toContain(token);
    }
  });

  it("carries the padding, type, and span-normalizing classes on every size", () => {
    const tokens = (size: "sm" | "default" | "lg") => badgeVariants({ size }).split(/\s+/);
    expect(tokens("sm")).toEqual(expect.arrayContaining(["px-2", "py-px", "text-xs"]));
    expect(tokens("default")).toEqual(expect.arrayContaining(["px-2.5", "py-0.5", "text-xs"]));
    expect(tokens("lg")).toEqual(expect.arrayContaining(["px-3", "py-1", "text-sm"]));
    expect(badgeVariants({ size: "sm" })).toContain("[&>span]:text-xs");
    expect(badgeVariants({ size: "default" })).toContain("[&>span]:text-xs");
    expect(badgeVariants({ size: "lg" })).toContain("[&>span]:text-sm");
    for (const size of ["sm", "default", "lg"] as const) {
      expect(badgeVariants({ size }), size).toContain("[&>span]:font-medium");
    }
  });
});
