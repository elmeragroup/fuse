import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { rangeCalendarVariants } from "../../styles/range-calendar";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "range-calendar.tsx"), "utf8");
const recipe = readFileSync(join(packageRoot, "src/styles/range-calendar.ts"), "utf8");
const facade = readFileSync(join(here, "../range-calendar.ts"), "utf8");

/** Every class the recipe can emit, across all three selection faces. */
function everyEmittedClass(): string {
  const invariant = rangeCalendarVariants();
  const faces = (["none", "middle", "cap"] as const).flatMap((selectionState) =>
    [false, true].flatMap((isDisabled) =>
      [false, true].map((isFocusVisible) =>
        rangeCalendarVariants({ selectionState, isDisabled, isFocusVisible }).cell()
      )
    )
  );
  return [invariant.body(), invariant.outerCell(), invariant.error(), ...faces].join(" ");
}

describe("range calendar source contract", () => {
  it("is a client module that reuses the shared header parts instead of forking them", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("@elmeragroup/ui/");
    // The header rows come from the calendar module (calendar.md §2 reuse seam); this
    // module declares neither of them and never touches their building blocks.
    expect(source).toContain('from "../calendar/calendar"');
    expect(source).not.toContain("function CalendarHeader");
    expect(source).not.toContain("function CalendarGridHeader");
    expect(source).not.toContain("CalendarHeaderCell");
    expect(source).not.toContain("useLocale");
  });

  it("hand-rolls its own cell recipe rather than borrowing Calendar's (§8.5)", () => {
    expect(source).not.toMatch(/\bcalendarVariants\b/);
    expect(recipe).not.toMatch(/\bcalendarVariants\b/);
  });

  it("keeps the facade a named re-export and the recipe module-private", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("rangeCalendarVariants");
  });

  it("takes no card-surface chrome on the root (§8.5 — standalone renders borderless)", () => {
    const emitted = everyEmittedClass();
    expect(emitted).not.toContain("bg-card");
    expect(emitted).not.toContain("border-border");
    expect(emitted).not.toContain("shadow-md");
    expect(emitted).not.toContain("rounded-md");
  });

  it("never emits a custom data-slot, size axis, or density override", () => {
    expect(source).not.toContain("data-slot");
    expect(source).not.toMatch(/\bsize:\s*\{/);
    expect(recipe).not.toMatch(/\bsize:\s*\{/);
    for (const text of [source, recipe]) {
      expect(text).not.toContain("data-density");
      expect(text).not.toContain("dense:");
      expect(text).not.toContain("comfortable:");
    }
    // No rung is pinned either: the day square is decorative, so nothing reads a
    // `--control-*` variable and no literal ladder is restated.
    expect(everyEmittedClass()).not.toContain("--control-");
    expect(rangeCalendarVariants.variantKeys).toEqual(
      expect.arrayContaining(["selectionState", "isDisabled"])
    );
    expect(rangeCalendarVariants.variantKeys).not.toContain("size");
  });

  it("never uses primitive gray/blue/white or destructive vocabulary", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toContain("text-gray-");
      expect(text).not.toContain("bg-gray-");
      expect(text).not.toContain("bg-blue-");
      // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
      expect(text).not.toContain("text-white");
      expect(text).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
      expect(text).not.toContain("destructive");
      expect(text).not.toMatch(RAW_PALETTE_RE);
      expect(text).not.toContain("dark:");
      expect(text).not.toContain("lucide");
    }
    expect(everyEmittedClass()).not.toMatch(RAW_PALETTE_RE);
  });
});

describe("rangeCalendarVariants", () => {
  it("zeroes the day-column gutter so the range band runs unbroken (§2)", () => {
    expect(rangeCalendarVariants().body()).toContain("[&_td]:px-0");
  });

  it("paints the range band, its caps and the row-edge rounding on the outer band (§2/§5)", () => {
    const outerCell = rangeCalendarVariants().outerCell();
    expect(outerCell).toContain("group");
    expect(outerCell).toContain("size-9");
    expect(outerCell).toContain("selected:bg-primary/20");
    expect(outerCell).toContain("invalid:selected:bg-error/10");
    expect(outerCell).toContain("selection-start:rounded-s-full");
    expect(outerCell).toContain("selection-end:rounded-e-full");
    expect(outerCell).toContain("[td:first-child_&]:rounded-s-full");
    expect(outerCell).toContain("[td:last-child_&]:rounded-e-full");
    expect(outerCell).toContain("outside-month:text-muted-foreground");
  });

  it("keeps the forced-colors fallbacks the reference had (§5)", () => {
    const outerCell = rangeCalendarVariants().outerCell();
    expect(outerCell).toContain("forced-colors:selected:bg-[Highlight]");
    expect(outerCell).toContain("forced-colors:invalid:selected:bg-[Mark]");
  });

  it("gives an un-selected pill the muted/accent interaction family (§5)", () => {
    const cell = rangeCalendarVariants({ selectionState: "none" }).cell();
    expect(cell).toContain("rounded-full");
    expect(cell).toContain("text-foreground");
    expect(cell).toContain("group-hover:bg-muted");
    expect(cell).toContain("group-pressed:bg-accent");
    expect(cell).not.toContain("bg-primary");
  });

  it("steps the middle band's pressed fill one stop above its hover fill (§5)", () => {
    const cell = rangeCalendarVariants({ selectionState: "middle" }).cell();
    expect(cell).toContain("group-hover:bg-primary/30");
    expect(cell).toContain("group-pressed:bg-primary/40");
    expect(cell).toContain("group-hover:group-invalid:bg-error/20");
    expect(cell).toContain("group-invalid:group-pressed:bg-error/30");
  });

  it("fills the end caps with primary, and with error while invalid (§5)", () => {
    const cell = rangeCalendarVariants({ selectionState: "cap" }).cell();
    expect(cell).toContain("bg-primary");
    expect(cell).toContain("text-primary-foreground");
    expect(cell).toContain("group-invalid:bg-error");
  });

  it("greys a disabled pill with the muted-foreground token (§5)", () => {
    expect(rangeCalendarVariants({ isDisabled: true }).cell()).toContain("text-muted-foreground");
    expect(rangeCalendarVariants({ isDisabled: false }).cell()).not.toContain("text-muted-foreground");
  });

  it("paints the shared state ring on the pill only while focus is visible", () => {
    expect(rangeCalendarVariants({ isFocusVisible: true }).cell()).toContain("ring-ring");
    expect(rangeCalendarVariants({ isFocusVisible: false }).cell()).not.toContain("ring-ring");
    expect(rangeCalendarVariants({ isFocusVisible: false }).cell()).toContain("outline-none");
  });

  it("marks the error copy with the error token and nothing else (§5)", () => {
    expect(rangeCalendarVariants().error()).toContain("text-error");
  });
});

describe("range calendar package surface", () => {
  it("is a subpath-only react-aria entry whose only value export is RangeCalendar", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/range-calendar");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["RangeCalendar"]);
    expect(entry?.sourceFile).toBe("src/react-aria/range-calendar.ts");
    expect(root?.runtimeExports).not.toContain("RangeCalendar");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/range-calendar");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("range-calendar");
  }, 30_000);
});
