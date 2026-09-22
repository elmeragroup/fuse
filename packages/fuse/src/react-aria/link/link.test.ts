import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { linkVariants } from "../../styles/link";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

function classes(rendered: string): string[] {
  return rendered.split(/\s+/).filter(Boolean).sort();
}

describe("linkVariants", () => {
  it("exposes exactly the five typography axes", () => {
    expect(linkVariants.variantKeys).toEqual(["variant", "leading", "truncate", "align", "weight"]);
    expect(linkVariants.variantKeys).not.toContain("size");
    // The focus state is composed at the call site from RAC render props, never an axis a
    // consumer could set.
    expect(linkVariants.variantKeys).not.toContain("isFocusVisible");
  });

  it("renders the base plus the default variant and weight, and nothing else", () => {
    expect(classes(linkVariants())).toEqual(
      classes("font-sans transition-opacity hover:opacity-80 text-inherit font-normal")
    );
  });

  it("maps every colour variant onto a role token", () => {
    const expected = {
      default: "text-inherit",
      foreground: "text-foreground",
      primary: "text-primary",
      secondary: "text-foreground",
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

  it("keeps the recorded quirk that default and inherit are the same variant", () => {
    expect(linkVariants({ variant: "inherit" })).toBe(linkVariants({ variant: "default" }));
    expect(classes(linkVariants({ variant: "inherit" }))).toContain("text-inherit");
  });

  it("keeps the recorded quirk that weight bold renders font-medium", () => {
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
