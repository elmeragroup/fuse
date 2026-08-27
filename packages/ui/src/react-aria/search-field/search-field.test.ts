import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { searchFieldStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "search-field.tsx"), "utf8");
const recipe = readFileSync(join(packageRoot, "src/styles/search-field.ts"), "utf8");
const facade = readFileSync(join(here, "../search-field.ts"), "utf8");

const CLEAR_COPY = {
  "nb-NO": "Tøm søket",
  "sv-SE": "Rensa sökningen",
  "en-US": "Clear search",
  "fi-FI": "Tyhjennä haku",
} as const;

describe("search-field dictionary", () => {
  it("owns the locked searchField.clear copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(searchFieldStrings.getStringForLocale("clear", locale), locale).toBe(CLEAR_COPY[locale]);
    }
  });

  it("carries no key beyond the single row accessibility.md §4.1 assigns to SearchField", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(searchFieldStrings.getStringsForLocale(locale)), locale).toEqual(["clear"]);
    }
  });
});

describe("search-field source contract", () => {
  it("is a client module that never reaches for the reference or its own public specifier", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("@elmeragroup/ui/");
    expect(recipe).not.toContain(".ref/");
    // The recipe lives in `src/styles/`, the one location every RAC entry uses
    // (range-calendar.md §8.2); the component declares no `tv()` of its own.
    expect(source).not.toContain("tv(");
    expect(source).not.toContain("tailwind-variants");
    expect(source).toContain('from "../../styles/search-field"');
  });

  it("keeps the facade a directive-free named re-export that hides the private recipe", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("searchFieldVariants");
    expect(recipe).not.toContain('"use client"');
  });

  it("composes the private RAC field parts and RAC Button instead of forking them", () => {
    expect(source).not.toContain('from "./field"');
    expect(source).not.toContain('from "./button"');
    expect(source).not.toContain('from "./utils"');
  });

  it("takes the glyphs from the Phosphor MagnifyingGlass and X roster entries (§8.2)", () => {
    expect(source).toContain('from "../../icons/generated/magnifying-glass"');
    expect(source).toContain('from "../../icons/generated/x"');
    expect(source).toContain("MagnifyingGlass");
    expect(source).toContain("<X ");
    expect(source).not.toContain("lucide");
  });

  it("hides the empty clear button via the explicit data-attribute variant (§8.5)", () => {
    expect(recipe).toContain("group-data-[empty]:");
    expect(recipe).not.toContain("group-empty:");
  });

  it("does not hardcode the four locked copies", () => {
    for (const copy of Object.values(CLEAR_COPY)) {
      expect(source).not.toContain(copy);
    }
  });

  it("never emits a size axis, a density override, or a hardcoded field-box height", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toContain("h-9");
      expect(text).not.toMatch(/\bsize:\s*\{/);
      expect(text).not.toContain("data-density");
      expect(text).not.toContain("dense:");
      expect(text).not.toContain("comfortable:");
    }
  });

  it("never uses primitive gray/white, destructive vocabulary, or a dark variant", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toContain("text-gray-");
      expect(text).not.toContain("bg-gray-");
      // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
      expect(text).not.toContain("text-white");
      // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
      expect(text).not.toContain("bg-white");
      expect(text).not.toContain("bg-background");
      expect(text).not.toContain("destructive");
      expect(text).not.toMatch(RAW_PALETTE_RE);
      expect(text).not.toContain("dark:");
      expect(text).not.toContain("inverted:");
    }
  });
});

describe("search-field package surface", () => {
  it("is a subpath-only react-aria entry whose only value export is SearchField", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/search-field");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["SearchField"]);
    expect(entry?.sourceFile).toBe("src/react-aria/search-field.ts");
    expect(root?.runtimeExports).not.toContain("SearchField");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/search-field");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("search-field");
  }, 30_000);
});
