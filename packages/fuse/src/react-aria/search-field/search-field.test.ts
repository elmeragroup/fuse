import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { searchFieldStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

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
