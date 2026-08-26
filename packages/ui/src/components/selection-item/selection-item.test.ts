import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { itemVariants } from "../item/item-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "selection-item.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "selection-item.ts"), "utf8");

describe("selection-item source contract", () => {
  it("is a client namespace that composes public itemVariants pinned to outline", () => {
    expect(source).toContain('"use client"');
    expect(source).not.toContain(".ref/");
    expect(source).toContain('itemVariants({ variant: "outline" })');
    expect(source).toContain('from "../item/item-variants"');
    expect(itemVariants({ variant: "outline" })).toContain("border-border");
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain('export { SelectionItem } from "./components/selection-item/selection-item"');
    expect(facade).not.toContain("itemVariants");
    expect(facade).not.toContain("CheckboxItem");
    expect(facade).not.toContain("RadioItem");
    expect(facade).not.toContain("selectionItemVariants");
  });

  it("keeps the stacked checked-border repaint and identity partitioning", () => {
    expect(source).toContain("has-data-checked:not-first:-mt-px");
    expect(source).toContain("has-data-checked:not-first:border-t");
    expect(source).toContain("not-first:border-t-0");
    expect(source).toContain("child.type === SelectionItemSubSection");
  });

  it("reuses disabledHatch and derives the sub-section spacer from the control slot", () => {
    expect(source).toContain("disabledHatch");
    expect(source).toContain('from "../../styles/utils"');
    expect(source).toContain("controlPosition");
    expect(source).not.toContain('className="w-4 shrink-0"');
    expect(source).not.toContain("w-4 shrink-0");
    expect(source).toContain("grid-cols-subgrid");
    expect(source).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(source).toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(source).not.toContain("ResizeObserver");
    expect(source).not.toContain("useLayoutEffect");
    expect(source).not.toContain("getBoundingClientRect");
    expect(source).not.toContain("controlSlotWidth");
  });

  it("does not keep destructive classes, dark variants, or density stamps", () => {
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(/\b(?:dense|comfortable):/);
    expect(source).not.toContain("data-density");
    expect(source).not.toContain("--control-h-");
    expect(source).not.toMatch(RAW_PALETTE_RE);
  });
});
