import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "date-field.tsx"), "utf8");
const facade = readFileSync(join(here, "../date-field.ts"), "utf8");

describe("date-field source contract", () => {
  it("is a client module that does not fork a local field or styles recipe", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain('from "./field"');
    expect(source).not.toContain('from "../styles"');
  });

  it("keeps the facade a named re-export and hides the private recipe", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("dateFieldVariants");
  });

  it("never emits its own data-slot, size axis, or hardcoded field-box height", () => {
    expect(source).not.toContain("data-slot");
    expect(source).not.toContain("h-9");
    expect(source).not.toContain("size:");
    expect(source).not.toContain("data-density");
    expect(source).not.toContain("dense:");
    expect(source).not.toContain("comfortable:");
  });

  it("never uses primitive gray/white or destructive vocabulary", () => {
    expect(source).not.toContain("text-gray-");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("text-white");
    expect(source).not.toContain("bg-background");
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toContain("destructive");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("bg-white");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toContain("dark:");
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
