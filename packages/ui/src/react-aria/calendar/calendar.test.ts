import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "calendar.tsx"), "utf8");
const recipe = readFileSync(join(packageRoot, "src/styles/calendar.ts"), "utf8");
const facade = readFileSync(join(here, "../calendar.ts"), "utf8");

describe("calendar source contract", () => {
  it("is a client module that does not fork a local button, heading, or text internal", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain('from "../../components/button/button"');
    expect(source).not.toContain("internal/heading");
    expect(source).not.toContain("internal/text");
    for (const text of [source, recipe]) {
      expect(text).not.toContain(".ref/");
      expect(text).not.toContain("@elmeragroup/ui/");
    }
    // The recipe lives in `src/styles/`, the one location every RAC entry uses
    // (range-calendar.md §8.2); the component declares no `tv()` of its own.
    expect(source).not.toContain("tailwind-variants");
    expect(source).toContain('from "../../styles/calendar"');
  });

  it("keeps the facade a named re-export and hides the private recipe", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("calendarVariants");
    expect(facade).not.toContain("cellVariants");
  });

  it("never emits a custom data-slot, size axis, or density override", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toContain("data-slot");
      expect(text).not.toMatch(/\bsize:\s*\{/);
      expect(text).not.toContain("data-density");
      expect(text).not.toContain("dense:");
      expect(text).not.toContain("comfortable:");
    }
  });

  it("never uses primitive gray/white, lucide carets, or destructive vocabulary", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toContain("text-gray-");
      expect(text).not.toContain("bg-gray-");
      expect(text).not.toContain("text-zinc-");
      // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
      expect(text).not.toContain("text-white");
      // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
      expect(text).not.toContain("border-black");
      expect(text).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
      expect(text).not.toContain("destructive");
      // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
      expect(text).not.toContain("bg-white");
      expect(text).not.toMatch(RAW_PALETTE_RE);
      expect(text).not.toContain("dark:");
      expect(text).not.toContain("lucide");
      expect(text).not.toContain("ChevronLeft");
      expect(text).not.toContain("ChevronRight");
    }
  });
});

describe("calendar package surface", () => {
  it("is a subpath-only react-aria entry whose value exports are Calendar and the header parts", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/calendar");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["Calendar", "CalendarHeader", "CalendarGridHeader"]);
    expect(entry?.sourceFile).toBe("src/react-aria/calendar.ts");
    expect(root?.runtimeExports).not.toContain("Calendar");
    expect(root?.runtimeExports).not.toContain("CalendarHeader");
    expect(root?.runtimeExports).not.toContain("CalendarGridHeader");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/calendar");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("calendar");
  }, 30_000);
});
