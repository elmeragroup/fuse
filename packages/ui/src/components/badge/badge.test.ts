import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import { badgeVariants } from "./badge-variants";

const here = dirname(fileURLToPath(import.meta.url));

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

const PALETTE_RE =
  /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|gray|zinc|slate|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)\b/;

describe("badgeVariants", () => {
  it("defaults to variant=default and size=default", () => {
    const resolved = badgeVariants();
    expect(resolved).toBe(badgeVariants({ variant: "default", size: "default" }));
    expect(resolved).toContain("bg-primary");
    expect(resolved).toContain("px-2.5");
    expect(resolved).toContain("py-0.5");
    expect(resolved).toContain("text-xs");
  });

  it("keeps the non-interactive base without focus styling", () => {
    const resolved = badgeVariants();
    expect(resolved).toContain("inline-flex");
    expect(resolved).toContain("items-center");
    // Radius derives from the brand `--radius` scale (badge.md §5).
    expect(resolved).toContain("rounded-lg");
    expect(resolved).toContain("transition-colors");
    // badge.md §8.5 — the ref's bare `:focus` ring is removed.
    expect(resolved).not.toContain("focus:");
    expect(resolved).not.toContain("focus-visible:");
    expect(resolved).not.toContain("ring-");
  });

  it("resolves all fourteen variants without raw palette or dark classes", () => {
    for (const variant of VARIANTS) {
      const resolved = badgeVariants({ variant });
      expect(resolved, variant).not.toBe("");
      expect(resolved, variant).not.toContain("dark:");
      expect(resolved, variant).not.toMatch(PALETTE_RE);
    }
    expect(new Set(VARIANTS).size).toBe(14);
  });

  it("renames the destructive-named variants onto the canonical error tokens", () => {
    const filled = badgeVariants({ variant: "destructive" });
    expect(filled).toContain("bg-error");
    expect(filled).toContain("text-error-foreground");
    expect(filled).toContain("hover:bg-error/80");
    expect(filled).not.toContain("destructive");

    const outline = badgeVariants({ variant: "outline-destructive" });
    expect(outline).toContain("border-error");
    expect(outline).toContain("text-error");
    expect(outline).toContain("hover:bg-error");
    expect(outline).toContain("hover:text-error-foreground");
    expect(outline).not.toContain("destructive");
  });

  it("keeps the sanctioned token-derived color-mix values on the info variant", () => {
    const resolved = badgeVariants({ variant: "info" });
    expect(resolved).toContain("bg-[color-mix(in_oklch,var(--info)_8%,transparent)]");
    expect(resolved).toContain("border-[color-mix(in_oklch,var(--info)_16%,transparent)]");
    expect(resolved).toContain("hover:bg-[color-mix(in_oklch,var(--info)_16%,transparent)]");
    expect(resolved).toContain("text-info-foreground");
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
    // The hover arm is a different modifier, so it survives the merge.
    expect(merged).toContain("hover:bg-success/80");
  });

  it("reads no --control-* variable: the size axis is decorative, not a density rung", () => {
    for (const size of ["sm", "default", "lg"] as const) {
      expect(badgeVariants({ size }), size).not.toContain("--control-");
      expect(badgeVariants({ size }), size).not.toContain("data-density");
    }
  });
});

describe("badge source contract", () => {
  it("ships every spec §10 demo as a runnable file", () => {
    for (const demo of ["badge-basic.tsx", "badge-variants.tsx", "badge-status.tsx", "badge-sizes.tsx"]) {
      expect(existsSync(join(here, "demos", demo)), demo).toBe(true);
    }
  });

  it("stays a server surface that emits data-slot before the props spread", () => {
    const source = readFileSync(join(here, "badge.tsx"), "utf8");
    expect(source).not.toContain("use client");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    const marker = 'data-slot="badge"';
    expect(source).toContain(marker);
    expect(source.indexOf(marker)).toBeLessThan(source.indexOf("{...props}", source.indexOf(marker)));
  });

  it("exports the recipe publicly from the badge entry", () => {
    const facade = readFileSync(join(here, "..", "..", "badge.ts"), "utf8");
    expect(facade).toContain('export { badgeVariants } from "./components/badge/badge-variants";');
    expect(facade).toContain('export { Badge } from "./components/badge/badge";');
  });

  it("carries no destructive class name in library source", () => {
    const recipe = readFileSync(join(here, "badge-variants.ts"), "utf8");
    for (const forbidden of [
      "bg-destructive",
      "text-destructive",
      "border-destructive",
      "hover:bg-destructive",
    ]) {
      expect(recipe, forbidden).not.toContain(forbidden);
    }
  });
});
