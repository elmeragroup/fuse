import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { rangeCalendarVariants } from "../../styles/range-calendar";

/** Every class the recipe can emit, across all three selection faces. */
function everyEmittedClass(): string {
  const invariant = rangeCalendarVariants();
  const faces = (["none", "middle", "cap"] as const).flatMap((selectionState) =>
    [false, true].flatMap((isDisabled) =>
      [false, true].flatMap((isUnavailable) =>
        [false, true].map((isFocusVisible) =>
          rangeCalendarVariants({ selectionState, isDisabled, isUnavailable, isFocusVisible }).cell()
        )
      )
    )
  );
  return [invariant.body(), invariant.outerCell(), invariant.error(), ...faces].join(" ");
}

describe("rangeCalendarVariants", () => {
  it("emits no size axis, no control rung, and no raw palette", () => {
    // The day square is decorative, so nothing reads a `--control-*` variable.
    expect(everyEmittedClass()).not.toContain("--control-");
    expect(everyEmittedClass()).not.toMatch(RAW_PALETTE_RE);
    expect(rangeCalendarVariants.variantKeys).toEqual(
      expect.arrayContaining(["selectionState", "isDisabled", "isUnavailable"])
    );
    expect(rangeCalendarVariants.variantKeys).not.toContain("size");
  });

  it("zeroes the day-column gutter so the range band runs unbroken", () => {
    expect(rangeCalendarVariants().body()).toContain("[&_td]:px-0");
  });

  it("paints the range band, its caps and the row-edge rounding on the outer band", () => {
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

  it("keeps the forced-colors fallbacks the reference had", () => {
    const outerCell = rangeCalendarVariants().outerCell();
    expect(outerCell).toContain("forced-colors:selected:bg-[Highlight]");
    expect(outerCell).toContain("forced-colors:invalid:selected:bg-[Mark]");
  });

  it("gives an un-selected pill the muted/accent interaction family", () => {
    const cell = rangeCalendarVariants({ selectionState: "none" }).cell();
    expect(cell).toContain("rounded-full");
    expect(cell).toContain("text-foreground");
    expect(cell).toContain("group-hover:bg-muted");
    expect(cell).toContain("group-pressed:bg-accent");
    expect(cell).not.toContain("bg-primary");
  });

  it("steps the middle band's pressed fill one stop above its hover fill", () => {
    const cell = rangeCalendarVariants({ selectionState: "middle" }).cell();
    expect(cell).toContain("group-hover:bg-primary/30");
    expect(cell).toContain("group-pressed:bg-primary/40");
    expect(cell).toContain("group-hover:group-invalid:bg-error/20");
    expect(cell).toContain("group-invalid:group-pressed:bg-error/30");
  });

  it("fills the end caps with primary, and with error while invalid", () => {
    const cell = rangeCalendarVariants({ selectionState: "cap" }).cell();
    expect(cell).toContain("bg-primary");
    expect(cell).toContain("text-primary-foreground");
    expect(cell).toContain("group-invalid:bg-error");
  });
});
