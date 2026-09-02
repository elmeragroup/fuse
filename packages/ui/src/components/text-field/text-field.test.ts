import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { fieldBox } from "../../styles/field-box";
import { cardVariants } from "../card/card-variants";
import { textFieldVariants } from "./text-field-variants";

const here = dirname(fileURLToPath(import.meta.url));

describe("textFieldVariants", () => {
  it("exposes the spec slots and no textArea slot", () => {
    const slots = textFieldVariants();
    expect(slots.base()).toContain("flex-col");
    expect(slots.fieldGroup()).toContain("w-auto");
    expect(String(slots.input())).not.toContain("text-lg");
    expect(slots.labelContainer()).toContain("justify-between");
    expect(slots.container()).toContain("flex-col");
    expect(slots.description()).toContain("text-sm");
    expect(slots.iconContainer()).toContain("absolute");
    expect(slots).not.toHaveProperty("textArea");
  });

  it("composes cardVariants on variant=card and restyles inline chrome", () => {
    const card = textFieldVariants({ variant: "card" });
    const cardBase = cardVariants().base();
    for (const token of cardBase.split(/\s+/).filter(Boolean)) {
      expect(card.base(), token).toContain(token);
    }
    expect(card.base()).toContain("gap-0");
    expect(card.base()).toContain("px-6");
    expect(card.base()).toContain("py-4");
    expect(card.fieldGroup()).toContain("w-full");
    expect(card.fieldGroup()).toContain("border-none");
    expect(card.input()).toContain("text-lg");
    expect(card.container()).toContain("flex-row");
    expect(card.label()).toContain("text-muted-foreground");

    const inline = textFieldVariants({ variant: "inline" });
    expect(inline.base()).toContain("group/inline-field");
    expect(inline.fieldGroup()).toContain("border-transparent");
    expect(inline.fieldGroup()).toContain("focus-visible:border-ring");
    // oxlint-disable-next-line elmera/no-local-focus-ring -- source-grep of the forbidden class, not a recipe
    expect(inline.fieldGroup()).not.toContain("group-focus-within/inline-field:border-ring");
    expect(inline.fieldGroup()).not.toContain("has-focus-visible:border-ring");
    expect(cn(fieldBox(), inline.fieldGroup())).toContain("focus-visible:border-ring");
    expect(inline.fieldGroup()).toContain("group-data-[invalid]/inline-field:border-error");
    expect(inline.fieldGroup()).not.toContain("destructive");
  });

  it("hides the root and pads the input when an icon is active", () => {
    expect(textFieldVariants({ hidden: true }).base()).toContain("hidden");
    const withIcon = textFieldVariants({ isIconActive: true });
    expect(withIcon.fieldGroup()).toContain("relative");
    expect(withIcon.input()).toContain("pr-10");
  });

  it("pins no size axis and carries no raw palette, dark, inverted, or density variants", () => {
    const resolved = [
      textFieldVariants().base(),
      textFieldVariants({ variant: "card" }).base(),
      textFieldVariants({ variant: "inline" }).fieldGroup(),
      textFieldVariants({ isIconActive: true }).input(),
    ].join(" ");
    expect(resolved).not.toMatch(/(?:^|\s)h-\d/);
    expect(resolved).not.toContain("h-(--control-h-");
    expect(resolved).not.toContain("dark:");
    expect(resolved).not.toContain("inverted:");
    expect(resolved).not.toMatch(/\b(?:dense|comfortable):/);
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
    expect(resolved).not.toContain("destructive");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(resolved).not.toContain("bg-white");
  });
});

describe("text-field source contract", () => {
  it("forwards isDisabled to the inner input and stays a client surface", () => {
    const source = readFileSync(join(here, "text-field.tsx"), "utf8");
    expect(source).toContain('"use client"');
    expect(source).not.toContain(".ref/");
    expect(source).toContain("disabled={isDisabled}");
    expect(source).toContain("invalid={isInvalid}");
    expect(source).toContain('filter === "numeric"');
    expect(source).toContain("SpinnerGap");
    expect(source).toContain("animate-spin");
    expect(source).toContain("Check");
  });

  it("does not keep the dead textArea slot, NumericOnlyTextField, or forbidden tokens", () => {
    const source = [
      readFileSync(join(here, "text-field.tsx"), "utf8"),
      readFileSync(join(here, "text-field-variants.ts"), "utf8"),
    ].join("\n");
    expect(source).not.toContain("textArea");
    expect(source).not.toContain("NumericOnlyTextField");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("bg-white");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("inverted:");
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
  });

  it("exports the recipe publicly from the text-field entry", () => {
    const facade = readFileSync(join(here, "..", "..", "text-field.ts"), "utf8");
    expect(facade).toContain(
      'export { textFieldVariants } from "./components/text-field/text-field-variants";'
    );
    expect(facade).toContain('export { TextField } from "./components/text-field/text-field";');
  });
});
