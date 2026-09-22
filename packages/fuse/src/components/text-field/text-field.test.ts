import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { fieldBox } from "../../styles/field-box";
import { cardVariants } from "../card/card-variants";
import { fieldFrameVariants } from "../field/field-frame";
import { textFieldVariants } from "./text-field-variants";

describe("textFieldVariants", () => {
  it("composes FieldFrame recipe slots under its public slot names", () => {
    // Unit under test: textFieldVariants' slot wiring. Oracle: fieldFrameVariants, the
    // upstream recipe whose classes the text field must forward unchanged.
    const slots = textFieldVariants();
    const frame = fieldFrameVariants();
    expect(slots.base()).toBe(frame.root());
    expect(slots.labelContainer()).toBe(frame.labelRow());
    expect(slots.container()).toBe(frame.content());
    expect(slots.description()).toBe(frame.description());
  });

  it("exposes the public slots and no textArea slot", () => {
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
    // Oracle: cardVariants, the upstream recipe every base token must survive twMerge with.
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
