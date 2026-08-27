import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "calendar.tsx"), "utf8");
const facade = readFileSync(join(here, "../calendar.ts"), "utf8");

describe("calendar source contract", () => {
  it("is a client module that does not fork a local button, heading, or text internal", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("@elmeragroup/ui/");
    expect(source).not.toContain('from "../../components/button/button"');
    expect(source).not.toContain("internal/heading");
    expect(source).not.toContain("internal/text");
  });

  it("keeps the facade a named re-export and hides the private recipe", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("calendarVariants");
    expect(facade).not.toContain("cellVariants");
  });

  it("never emits a custom data-slot, size axis, or density override", () => {
    expect(source).not.toContain("data-slot");
    expect(source).not.toMatch(/\bsize:\s*\{/);
    expect(source).not.toContain("data-density");
    expect(source).not.toContain("dense:");
    expect(source).not.toContain("comfortable:");
  });

  it("never uses primitive gray/white, lucide carets, or destructive vocabulary", () => {
    expect(source).not.toContain("text-gray-");
    expect(source).not.toContain("bg-gray-");
    expect(source).not.toContain("text-zinc-");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("text-white");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("border-black");
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toContain("destructive");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("bg-white");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("lucide");
    expect(source).not.toContain("ChevronLeft");
    expect(source).not.toContain("ChevronRight");
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
