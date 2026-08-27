import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { linkVariants } from "./link-variants";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "link.tsx"), "utf8");
const recipe = readFileSync(join(here, "link-variants.ts"), "utf8");
const facade = readFileSync(join(here, "../link.ts"), "utf8");

function classes(rendered: string): string[] {
  return rendered.split(/\s+/).filter(Boolean).sort();
}

describe("link source contract", () => {
  it("is a client module that never reaches for the reference or its own public specifier", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("@elmeragroup/ui/");
    expect(recipe).not.toContain(".ref/");
  });

  it("keeps the facade a directive-free named re-export that hides the private recipe", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("linkVariants");
  });

  it("never emits a custom data-slot, a size axis, or a density override", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toContain("data-slot");
      expect(text).not.toMatch(/\bsize:\s*\{/);
      expect(text).not.toContain("data-density");
      expect(text).not.toContain("dense:");
      expect(text).not.toContain("comfortable:");
      expect(text).not.toContain("--control-");
    }
  });

  it("never uses destructive vocabulary, raw palette, or a dark variant", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toMatch(RAW_PALETTE_RE);
      expect(text).not.toContain("dark:");
      expect(text).not.toContain("inverted:");
    }
    // §8.2: the ref's `destructive` value is renamed `error`; the word is gone from source.
    expect(recipe).not.toMatch(/destructive/);
    expect(source).not.toMatch(/destructive/);
  });

  it("spells no focus class of its own — the shared recipe owns every one", () => {
    expect(recipe).not.toMatch(/\bring-/);
    expect(recipe).not.toContain("outline-none");
    expect(recipe).not.toContain("focus-visible:");
    expect(source).not.toMatch(/\bring-/);
    expect(source).not.toContain("focus-visible:");
  });

  it("carries no icon module", () => {
    expect(source).not.toContain("../../icons");
    expect(source).not.toContain("lucide");
  });
});

describe("linkVariants", () => {
  it("exposes exactly the five typography axes from link.md §4", () => {
    expect(linkVariants.variantKeys).toEqual(["variant", "leading", "truncate", "align", "weight"]);
    expect(linkVariants.variantKeys).not.toContain("size");
    // The focus state is composed at the call site from RAC render props, never an axis a
    // consumer could set (link.md §4, accessibility.md §2).
    expect(linkVariants.variantKeys).not.toContain("isFocusVisible");
  });

  it("renders the §4 base plus the default variant and weight, and nothing else", () => {
    expect(classes(linkVariants())).toEqual(
      classes("font-sans transition-opacity hover:opacity-80 text-inherit font-normal")
    );
  });

  it("maps every colour variant onto a role token", () => {
    const expected = {
      default: "text-inherit",
      foreground: "text-foreground",
      primary: "text-primary",
      secondary: "text-secondary",
      brand: "text-brand",
      muted: "text-muted-foreground",
      inherit: "text-inherit",
      error: "text-error",
    } as const;
    for (const [variant, className] of Object.entries(expected)) {
      // SAFETY: the keys above are exactly the recipe's own `variant` values.
      const rendered = linkVariants({ variant: variant as keyof typeof expected });
      expect(classes(rendered), variant).toContain(className);
    }
  });

  it("keeps the recorded quirk that default and inherit are the same variant (§8.3)", () => {
    expect(linkVariants({ variant: "inherit" })).toBe(linkVariants({ variant: "default" }));
    expect(classes(linkVariants({ variant: "inherit" }))).toContain("text-inherit");
  });

  it("keeps the recorded quirk that weight bold renders font-medium (§8.3)", () => {
    expect(classes(linkVariants({ weight: "bold" }))).toContain("font-medium");
    expect(classes(linkVariants({ weight: "bold" }))).not.toContain("font-bold");
    expect(classes(linkVariants({ weight: "normal" }))).toContain("font-normal");
  });

  it("maps the leading axis onto the line-height scale", () => {
    const expected = {
      none: "leading-none",
      tight: "leading-tight",
      snug: "leading-snug",
      relaxed: "leading-relaxed",
      loose: "leading-loose",
    } as const;
    for (const [leading, className] of Object.entries(expected)) {
      // SAFETY: the keys above are exactly the recipe's own `leading` values.
      expect(classes(linkVariants({ leading: leading as keyof typeof expected })), leading).toContain(
        className
      );
    }
    expect(classes(linkVariants())).not.toContain("leading-relaxed");
  });

  it("maps the align axis onto text alignment", () => {
    const expected = {
      left: "text-left",
      center: "text-center",
      right: "text-right",
      justify: "text-justify",
    } as const;
    for (const [align, className] of Object.entries(expected)) {
      // SAFETY: the keys above are exactly the recipe's own `align` values.
      expect(classes(linkVariants({ align: align as keyof typeof expected })), align).toContain(className);
    }
  });

  it("adds truncation only when asked", () => {
    expect(classes(linkVariants({ truncate: true }))).toContain("truncate");
    expect(classes(linkVariants())).not.toContain("truncate");
  });
});

describe("link package surface", () => {
  it("is a subpath-only react-aria entry whose only value export is Link", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/link");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["Link"]);
    expect(entry?.sourceFile).toBe("src/react-aria/link.ts");
    expect(root?.runtimeExports).not.toContain("Link");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/link");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("link");
  }, 30_000);
});
