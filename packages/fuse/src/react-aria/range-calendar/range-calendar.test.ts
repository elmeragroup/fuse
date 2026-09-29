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

  it("paints the range band, its caps, the row-edge rounding and the forced-colors fallbacks on the outer band", () => {
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
    // The forced-colors fallbacks the reference had.
    expect(outerCell).toContain("forced-colors:selected:bg-[Highlight]");
    expect(outerCell).toContain("forced-colors:invalid:selected:bg-[Mark]");
  });

  it("gives each selection face its own pill fill family", () => {
    const faces = {
      // An un-selected pill takes the muted/accent interaction family.
      none: {
        present: ["rounded-full", "text-foreground", "group-hover:bg-muted", "group-pressed:bg-accent"],
        absent: ["bg-primary"],
      },
      // The middle band's pressed fill steps one stop above its hover fill.
      middle: {
        present: [
          "group-hover:bg-primary/30",
          "group-pressed:bg-primary/40",
          "group-hover:group-invalid:bg-error/20",
          "group-invalid:group-pressed:bg-error/30",
        ],
        absent: [],
      },
      // The end caps fill with primary, and with error while invalid.
      cap: {
        present: ["bg-primary", "text-primary-foreground", "group-invalid:bg-error"],
        absent: [],
      },
    } as const;
    for (const [selectionState, { present, absent }] of Object.entries(faces)) {
      // SAFETY: the keys above are exactly the recipe's own `selectionState` values.
      const cell = rangeCalendarVariants({ selectionState: selectionState as keyof typeof faces }).cell();
      for (const token of present) {
        expect(cell, selectionState).toContain(token);
      }
      for (const token of absent) {
        expect(cell, selectionState).not.toContain(token);
      }
    }
  });
});
