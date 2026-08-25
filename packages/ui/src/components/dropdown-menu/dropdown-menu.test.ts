import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "dropdown-menu.tsx"), "utf8");
const facade = readFileSync(join(here, "../../dropdown-menu.ts"), "utf8");
const overlayClassesSource = readFileSync(join(here, "../overlay/overlay-classes.ts"), "utf8");

describe("dropdown-menu source contract", () => {
  it("declares the overlay layer once on each Positioner and never falls back to document.body", () => {
    // Source-grep: a single z-50 declaration (dropdown-menu.md §8.6) and the absence of a
    // body fallback (theming.md §7.4) have no consumer-behavior probe of their own.
    // The layer lives in the shared overlay module; this file borrows overlayLayer
    // and must not stamp a second z-50 on the Popup.
    expect(overlayClassesSource.match(/z-50/gu)).toHaveLength(1);
    expect(source).not.toContain("z-50");
    expect(source).toContain("overlayLayer");
    expect(source).toContain("isolate");
    expect(source).not.toContain("document.body");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
  });

  it("does not implement SubContent by rendering Content", () => {
    const subContentFn = source.slice(
      source.indexOf("function DropdownMenuSubContent"),
      source.indexOf("DropdownMenuRoot.displayName")
    );
    expect(source).not.toMatch(/<DropdownMenuContent\b/);
    expect(subContentFn).toContain("MenuPrimitive.Portal");
    expect(subContentFn).toContain("MenuPrimitive.Positioner");
    expect(subContentFn).toContain("MenuPrimitive.Popup");
    expect(subContentFn).toContain('align = "start"');
    expect(subContentFn).toContain("alignOffset = -3");
    expect(subContentFn).toContain('side = "right"');
    expect(subContentFn).toContain("sideOffset = 0");
    expect(subContentFn).toContain("min-w-[96px]");
    expect(subContentFn).toContain("shadow-lg");
    expect(subContentFn).not.toContain("shadow-md");
    expect(subContentFn).not.toContain("min-w-32");
  });

  it("keeps destructive as a variant value and data attribute, never as a class name", () => {
    expect(source).toContain('variant = "default"');
    expect(source).toContain('variant?: "default" | "destructive"');
    expect(source).toContain("data-variant={variant}");
    expect(source).toContain("data-[variant=destructive]:text-error");
    expect(source).toContain("data-[variant=destructive]:focus:bg-error/10");
    expect(source).toContain("data-[variant=destructive]:focus:text-error");
    expect(source).toContain("data-[variant=destructive]:*:[svg]:text-error");
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
  });

  it("keeps the lifted popup metrics, scrollbar guard, and item recipe hooks", () => {
    expect(source).toContain("max-h-(--available-height)");
    expect(source).toContain("overflow-y-auto");
    expect(source).toContain("data-closed:overflow-hidden");
    expect(source).toContain("min-w-32");
    expect(source).toContain("shadow-md");
    expect(source).toContain("ring-1 ring-foreground/10");
    expect(source).toContain("duration-100");
    expect(source).toContain("group/dropdown-menu-item");
    expect(source).toContain("closeParentOnEsc");
    expect(source).toContain("group-focus/dropdown-menu-item:text-accent-foreground");
    expect(source).toContain("selfFocusRing");
    expect(source).toContain("CaretRight");
    expect(source).not.toContain("ChevronRight");
    expect(source).not.toContain("lucide");
  });

  it("keeps dropdownMenuItemClassName module-private", () => {
    expect(source).toContain("const dropdownMenuItemClassName");
    expect(source).not.toContain("export const dropdownMenuItemClassName");
    expect(facade).not.toContain("dropdownMenuItemClassName");
    expect(source).not.toContain("dropdownMenuVariants");
    expect(facade).not.toContain("dropdownMenuVariants");
  });

  it("emits data-slot before the props spread on every rendering part", () => {
    for (const slot of [
      "dropdown-menu",
      "dropdown-menu-trigger",
      "dropdown-menu-portal",
      "dropdown-menu-content",
      "dropdown-menu-group",
      "dropdown-menu-label",
      "dropdown-menu-item",
      "dropdown-menu-link-item",
      "dropdown-menu-checkbox-item",
      "dropdown-menu-checkbox-item-indicator",
      "dropdown-menu-radio-group",
      "dropdown-menu-radio-item",
      "dropdown-menu-radio-item-indicator",
      "dropdown-menu-separator",
      "dropdown-menu-shortcut",
      "dropdown-menu-sub",
      "dropdown-menu-sub-trigger",
      "dropdown-menu-sub-content",
    ]) {
      expect(source, slot).toContain(`data-slot="${slot}"`);
    }
    for (const part of source.split("function ").slice(1)) {
      const slot = part.indexOf("data-slot=");
      const spread = part.indexOf("{...props}");
      if (slot === -1 || spread === -1) {
        continue;
      }
      expect(slot).toBeLessThan(spread);
    }
  });

  it("starts with the use client directive", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(facade.trimStart().startsWith("export")).toBe(true);
  });
});
