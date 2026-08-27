import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "date-field.tsx"), "utf8");
const recipe = readFileSync(join(packageRoot, "src/styles/date-field.ts"), "utf8");
const facade = readFileSync(join(here, "../date-field.ts"), "utf8");

describe("date-field source contract", () => {
  it("is a client module that does not fork a local field or styles recipe", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain('from "./field"');
    for (const text of [source, recipe]) {
      expect(text).not.toContain(".ref/");
    }
    // The recipe lives in `src/styles/`, the one location every RAC entry uses
    // (range-calendar.md §8.2); the component declares no `tv()` of its own.
    expect(source).not.toContain("tailwind-variants");
    expect(source).toContain('from "../../styles/date-field"');
  });

  it("keeps the facade a named re-export and hides the private recipe", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("dateFieldVariants");
  });

  it("never emits its own data-slot, size axis, or hardcoded field-box height", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toContain("data-slot");
      expect(text).not.toContain("h-9");
      expect(text).not.toContain("size:");
      expect(text).not.toContain("data-density");
      expect(text).not.toContain("dense:");
      expect(text).not.toContain("comfortable:");
    }
  });

  it("never uses primitive gray/white or destructive vocabulary", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toContain("text-gray-");
      // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
      expect(text).not.toContain("text-white");
      expect(text).not.toContain("bg-background");
      expect(text).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
      expect(text).not.toContain("destructive");
      // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
      expect(text).not.toContain("bg-white");
      expect(text).not.toMatch(RAW_PALETTE_RE);
      expect(text).not.toContain("dark:");
    }
  });
});

describe("date-field package surface", () => {
  it("is a subpath-only react-aria entry whose value exports are DateField and DateInput", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/date-field");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["DateField", "DateInput"]);
    expect(entry?.sourceFile).toBe("src/react-aria/date-field.ts");
    expect(root?.runtimeExports).not.toContain("DateField");
    expect(root?.runtimeExports).not.toContain("DateInput");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/date-field");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("date-field");
  }, 30_000);
});
