import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { gridListStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

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
