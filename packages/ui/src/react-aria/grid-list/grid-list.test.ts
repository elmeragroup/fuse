import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { gridListStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "grid-list.tsx"), "utf8");
const recipe = readFileSync(join(packageRoot, "src/styles/grid-list.ts"), "utf8");
const facade = readFileSync(join(here, "../grid-list.ts"), "utf8");

const DRAG_COPY = {
  "nb-NO": "Dra for å endre rekkefølge",
  "sv-SE": "Dra för att ändra ordning",
  "en-US": "Drag to reorder",
  "fi-FI": "Vedä järjestääksesi",
} as const;

describe("grid-list dictionary", () => {
  it("owns the locked gridList.drag copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(gridListStrings.getStringForLocale("drag", locale), locale).toBe(DRAG_COPY[locale]);
    }
  });

  it("carries no key beyond the one row accessibility.md §4.1 assigns to GridList", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(gridListStrings.getStringsForLocale(locale)), locale).toEqual(["drag"]);
    }
  });
});

describe("grid-list source contract", () => {
  it("is a client module that never reaches for the reference or its own public specifier", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("@elmeragroup/ui/");
    expect(recipe).not.toContain(".ref/");
    // The recipe lives in `src/styles/`, the one location every RAC entry uses
    // (range-calendar.md §8.2); the component declares no `tv()` of its own.
    expect(source).not.toContain("tv(");
    expect(source).not.toContain("tailwind-variants");
    expect(source).toContain('from "../../styles/grid-list"');
  });

  it("keeps the facade a directive-free named re-export that hides the private recipe", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("itemStyles");
    expect(facade).not.toContain("gridListVariants");
    expect(facade).not.toContain("checkboxVariants");
    expect(facade).not.toContain("Checkbox");
    expect(recipe).not.toContain('"use client"');
  });

  it("does not fork a local checkbox recipe or resurrect list-box", () => {
    expect(source).not.toContain('from "./checkbox"');
    expect(source).not.toContain('from "./utils"');
    expect(source).not.toContain("list-box");
    expect(source).not.toContain("ListBox");
    expect(recipe).not.toContain("list-box");
  });

  it("takes the glyphs from the Phosphor Check, Minus, and DotsSixVertical roster entries", () => {
    expect(source).toContain('from "../../icons/generated/check"');
    expect(source).toContain('from "../../icons/generated/minus"');
    expect(source).toContain('from "../../icons/generated/dots-six-vertical"');
    expect(source).toContain("<Check ");
    expect(source).toContain("<Minus ");
    expect(source).toContain("<DotsSixVertical");
    expect(source).toContain('from "../internal/button"');
    expect(source).not.toContain("≡");
    expect(source).not.toContain("lucide");
  });

  it("rewrites the empty plugin variants as explicit data-attribute variants (§8.5)", () => {
    expect(recipe).toContain("data-[empty]:flex");
    expect(recipe).toContain("data-[empty]:items-center");
    expect(recipe).toContain("data-[empty]:justify-center");
    expect(recipe).toContain("data-[empty]:text-sm");
    expect(recipe).not.toContain("empty:flex");
  });

  it("composes the shared state focus ring on itemStyles (§4)", () => {
    expect(recipe).toContain('focusRing({ target: "state" })');
    expect(recipe).toContain('focusRing({ target: "state", isFocusVisible: true })');
    expect(recipe).toContain("export const itemStyles");
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
      expect(text).not.toContain("destructive");
      expect(text).not.toMatch(RAW_PALETTE_RE);
      expect(text).not.toContain("dark:");
      expect(text).not.toContain("inverted:");
    }
  });
});

describe("grid-list package surface", () => {
  it("is a subpath-only react-aria entry whose value exports are GridList and GridListItem", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/grid-list");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["GridList", "GridListItem"]);
    expect(entry?.sourceFile).toBe("src/react-aria/grid-list.ts");
    expect(root?.runtimeExports).not.toContain("GridList");
    expect(root?.runtimeExports).not.toContain("GridListItem");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/grid-list");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("grid-list");
  }, 30_000);
});
