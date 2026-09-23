import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
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

  it("renames the destructive-named variants onto the canonical error tokens", () => {
    const filled = badgeVariants({ variant: "destructive" });
    expect(filled).toContain("bg-error");
    expect(filled).toContain("text-error-foreground");
    expect(filled).not.toContain("destructive");

    const outline = badgeVariants({ variant: "outline-destructive" });
    expect(outline).toContain("border-error");
    expect(outline).toContain("text-error");
    expect(outline).not.toContain("destructive");
  });

  it("pairs the info soft surface with its foreground", () => {
    const resolved = badgeVariants({ variant: "info" });
    expect(resolved).toContain("bg-info-soft");
    expect(resolved).toContain("border-info/20");
    expect(resolved).toContain("text-info-soft-foreground");
  });

  it("gives outline its bare border and foreground text", () => {
    const resolved = badgeVariants({ variant: "outline" });
    expect(resolved).toContain("text-foreground");
    expect(resolved).toContain("border");
    expect(resolved).not.toContain("bg-");
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

  it("lets a className merge win over a conflicting recipe class through cn", () => {
    const merged = cn(badgeVariants({ variant: "success", size: "lg" }), "text-xs bg-muted").split(/\s+/);
    expect(merged).toContain("bg-muted");
    expect(merged).not.toContain("bg-success");
    expect(merged).toContain("text-xs");
    expect(merged).not.toContain("text-sm");
  });

  it("reads no --control-* variable: the size axis is decorative, not a density rung", () => {
    for (const size of ["sm", "default", "lg"] as const) {
      expect(badgeVariants({ size }), size).not.toContain("--control-");
      expect(badgeVariants({ size }), size).not.toContain("data-density");
    }
  });
});
