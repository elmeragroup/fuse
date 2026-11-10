import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import { fieldBox, readOnlyFillCancelClass, readOnlyFillClass } from "../../styles/field-box";
import { cardVariants } from "../card/card-variants";
import { fieldFrameVariants } from "../field/field-frame-variants";
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

  it("composes cardVariants on variant=card and restyles inline chrome", () => {
    const card = textFieldVariants({ variant: "card" });
    // Oracle: cardVariants, the upstream recipe every base token must survive twMerge with,
    // except the inner corner the card publishes, which the field's own padding replaces, and
    // the card edge and shadow roles, which the field box replaces with its `--border` boundary
    // and the plain `shadow-xs` of every field box.
    const cardBase = cardVariants().base();
    const cardShadow = "shadow-[0_1px_2px_0_--theme(--color-card-shadow)]";
    const replaced = (token: string) =>
      token.startsWith("[--shell-inner:") || token === "border-card-border" || token === cardShadow;
    for (const token of cardBase.split(/\s+/).filter((token) => !replaced(token))) {
      expect(card.base(), token).toContain(token);
    }
    expect(cardBase, "precondition: the card draws the card edge role").toContain("border-card-border");
    expect(cardBase, "precondition: the card casts the card shadow role").toContain(cardShadow);
    expect(card.base()).not.toContain("border-card-border");
    expect(card.base()).not.toContain(cardShadow);
    expect(card.base()).toContain("border-border");
    expect(card.base().split(/\s+/)).toContain("shadow-xs");
    expect(card.base()).toContain("gap-0");
    expect(card.base()).toContain("px-[var(--card-pad,var(--surface-pad-md))]");
    expect(card.base()).toContain("py-4");
    expect(card.base()).toContain(
      "[--shell-inner:max(0px,--theme(--radius-lg)-1px-var(--card-pad,var(--surface-pad-md)))]"
    );
    expect(card.fieldGroup()).toContain("w-full");
    expect(card.fieldGroup()).toContain("border-none");
    expect(card.input()).toContain("text-lg");
    expect(card.container()).toContain("flex-row");
    expect(card.label()).toContain("text-muted-foreground");
    // The card is the read-only field box; the input inside it cancels its own fill.
    expect(card.base()).toContain("has-[input[readonly]:not(:disabled)]:bg-muted");
    expect(cn(fieldBox(), card.input())).toContain(readOnlyFillCancelClass);
    expect(cn(fieldBox(), card.input())).not.toContain(readOnlyFillClass);

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
});
