import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../test/raw-palette";
import { controlMdInsetTypeClass } from "./control-size-md";
import { pickerVariants } from "./picker";

/** Every class the recipe can emit, across every face of both axes. */
function everyEmittedClass(): string {
  return [false, true]
    .flatMap((range) =>
      [false, true].flatMap((hasPresets) => {
        const slots = pickerVariants({ range, hasPresets });
        return [
          slots.base(),
          slots.group(),
          slots.input(),
          slots.separator(),
          slots.icon(),
          slots.trigger(),
          slots.dialog(),
          slots.calendar(),
          slots.pane(),
        ];
      })
    )
    .join(" ");
}

/**
 * The range field's container-query breakpoint, named once for the expectations below.
 * Production spells it into each class string because Tailwind's source scan resolves no
 * interpolation; this constant is where the test tier keeps one name for it.
 */
const RANGE_BREAKPOINT = "24rem";

describe("pickerVariants shared slots", () => {
  it("lays both roots out as a labelled column", () => {
    expect(pickerVariants().base()).toContain("flex-col");
    expect(pickerVariants({ range: true }).base()).toContain("@container/picker");
  });

  it("strips the styled Dialog's padding in both of its forms, on both axes", () => {
    for (const range of [false, true]) {
      const dialog = pickerVariants({ range }).dialog();
      expect(dialog).toContain("p-0");
      // The dialog recipe re-pads itself inside a positioned popover, so that arm is
      // overridden too — otherwise the calendar would sit in 1rem of dead space.
      expect(dialog).toContain("[[data-placement]>&]:p-0");
    }
  });

  it("sizes the trigger glyph without an important flag — buttonVariants defers to it", () => {
    // `buttonVariants` only sizes `svg:not([class*='size-'])`, so a plain `size-4` on the
    // glyph already wins and the important flag it used to carry was noise.
    for (const range of [false, true]) {
      expect(pickerVariants({ range }).icon()).toBe("size-4 transition-colors");
    }
  });

  it("keeps the segment row on the md rung's padding and type pair at both densities", () => {
    for (const range of [false, true]) {
      const input = pickerVariants({ range }).input();
      // Oracle: the text-entry inset-and-type pair, which control-size.test.ts pins by hand.
      expect(input.split(" ")).toEqual(expect.arrayContaining(controlMdInsetTypeClass.split(" ")));
      expect(input).not.toContain("py-");
      expect(input).not.toContain("text-sm");
      expect(input).not.toContain("px-2");
    }
  });

  it("emits exactly the two documented axes and no raw palette", () => {
    expect(pickerVariants.variantKeys).toEqual(["range", "hasPresets"]);
    expect(everyEmittedClass()).not.toMatch(RAW_PALETTE_RE);
  });

  // FieldGroup owns the md control height (`fieldGroupVariants` in
  // react-aria/internal/field.tsx), the surface, border, focus ring and the read-only fill.
  // The recipe may opt the narrow two-row box out of the height with `h-auto`, but naming
  // any of these here would make it a second owner. The read-only fill used to be painted
  // twice here, on `group` and again on `icon`, while DateField already routed the state
  // through FieldGroup's `isReadOnly` axis.
  it.each(["--control-h-", "bg-card", "border-input", "ring-ring", "shadow-md", "bg-muted"])(
    "emits no %s on any slot — FieldGroup owns it",
    (fragment) => {
      expect(everyEmittedClass()).not.toContain(fragment);
    }
  );
});

describe("pickerVariants range axis", () => {
  it("floors the single-date field box at 180px and lets its one row grow", () => {
    const slots = pickerVariants();
    expect(slots.group()).toContain("w-auto");
    expect(slots.group()).toContain("min-w-[180px]");
    expect(slots.input()).toContain("flex-1");
    expect(slots.input()).toContain("min-w-[150px]");
  });

  it("floors the range field box at 208px and keeps its shared row flexless", () => {
    const slots = pickerVariants({ range: true });
    expect(slots.group()).toContain("w-auto");
    expect(slots.group()).toContain("min-w-[208px]");
    // Only the wide template's end column grows; neither row carries a growth class.
    expect(slots.input()).not.toContain("flex-1");
    expect(slots.input()).not.toContain("--control-h-");
  });

  it("keeps one grid model across the 24rem breakpoint and only retemplates columns", () => {
    const group = pickerVariants({ range: true }).group();
    expect(group).toContain("grid");
    expect(group).not.toContain("flex");
    expect(group).toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(group).toContain(`@min-[${RANGE_BREAKPOINT}]/picker:grid-cols-[auto_auto_minmax(0,1fr)_auto]`);
    // FieldGroup's md height stands above 24rem; below it the two stacked rows size to
    // their content instead.
    expect(group).toContain(`@max-[${RANGE_BREAKPOINT}]/picker:h-auto`);
    expect(group).not.toContain("--control-h-");
  });

  it("strips Calendar's card chrome and pays RangeCalendar's inset", () => {
    // Calendar's root carries its own `p-2` and a card's border, shadow and fill, which
    // the popover already provides; RangeCalendar's root is bare by design above a
    // `p-0` dialog, so the range arm is where that inset comes from.
    expect(pickerVariants().calendar()).toBe("border-none bg-transparent shadow-none");
    expect(pickerVariants({ range: true }).calendar()).toBe("p-2");
  });

  it("colours the separator with role tokens only on the range axis", () => {
    const separator = pickerVariants({ range: true }).separator();
    expect(separator).toContain("text-foreground");
    expect(separator).toContain("group-disabled:text-muted-foreground");
    expect(separator).toContain("forced-colors:text-[ButtonText]");
    expect(separator).toContain("forced-colors:group-disabled:text-[GrayText]");
    // A single-date picker renders no separator at all.
    expect(pickerVariants().separator()).toBeUndefined();
  });

  it("hands the shell the trigger's grid placement on the range axis only", () => {
    const trigger = pickerVariants({ range: true }).trigger();
    // Narrow: the trigger spans both stacked rows in the second column.
    expect(trigger).toContain("col-start-2");
    expect(trigger).toContain("row-span-2");
    expect(trigger).toContain("row-start-1");
    // Wide: the trigger is the fourth column of the single row, no longer spanning rows.
    expect(trigger).toContain(`@min-[${RANGE_BREAKPOINT}]/picker:col-start-4`);
    expect(trigger).toContain(`@min-[${RANGE_BREAKPOINT}]/picker:row-span-1`);
    // The single-date trigger carries no placement class.
    expect(pickerVariants().trigger()).not.toMatch(/(?:col|row)-/);
  });

  it.each([false, true])(
    "gives the dialog its two-pane row only when the caller has presets (range: %s)",
    (range) => {
      // The two-pane layout is the border-coloured divider, with no padding or gap of its
      // own so the divider reaches the popover's edges; a lone calendar takes none of it,
      // and the slot must be empty rather than absent so the call site can hand the class
      // through unconditionally.
      expect(pickerVariants({ range, hasPresets: true }).pane().split(/\s+/).toSorted()).toEqual(
        [
          "flex",
          "flex-col",
          "sm:flex-row",
          "sm:divide-x",
          "sm:divide-y-0",
          "divide-y",
          "divide-border",
        ].toSorted()
      );
      // tailwind-variants collapses an empty slot face to `undefined`, which is what the
      // call site wants: React then omits the attribute rather than emitting `class=""`.
      expect(pickerVariants({ range, hasPresets: false }).pane()).toBeUndefined();
      expect(pickerVariants({ range }).pane()).toBeUndefined();
    }
  );

  it("keeps RangeCalendar's own inset beside the preset pane", () => {
    expect(pickerVariants({ range: true, hasPresets: true }).calendar()).toBe("p-2");
  });
});
