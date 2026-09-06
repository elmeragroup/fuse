import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../test/raw-palette";
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
          slots.dialog(),
          slots.calendar(),
          slots.pane(),
        ];
      })
    )
    .join(" ");
}

describe("pickerVariants shared slots", () => {
  it("lays both roots out as a labelled column", () => {
    expect(pickerVariants().base()).toBe("group flex flex-col gap-1");
    expect(pickerVariants({ range: true }).base()).toBe("group flex flex-col gap-1");
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
      expect(input).toContain("px-(--control-px-md)");
      expect(input).toContain("[font-size:var(--control-text)]");
      expect(input).toContain("[line-height:var(--control-leading)]");
      expect(input).not.toContain("py-");
      expect(input).not.toContain("text-sm");
      expect(input).not.toContain("px-2");
    }
  });

  it("emits exactly the two documented axes, no control rung, and no raw palette", () => {
    expect(pickerVariants.variantKeys).toEqual(["range", "hasPresets"]);
    expect(everyEmittedClass()).not.toContain("--control-h-");
    expect(everyEmittedClass()).not.toMatch(RAW_PALETTE_RE);
  });

  it("owns no surface, border or focus ring of its own", () => {
    const emitted = everyEmittedClass();
    expect(emitted).not.toContain("bg-card");
    expect(emitted).not.toContain("border-input");
    expect(emitted).not.toContain("ring-ring");
    expect(emitted).not.toContain("shadow-md");
  });

  it("paints no read-only fill on any slot — FieldGroup owns it", () => {
    // The fill used to be painted twice here — on `group` and again on `icon` — while
    // `fieldGroupVariants` carried an `isReadOnly` axis all along and DateField already
    // routed the state through it. PickerShell now hands `isReadOnly` to the FieldGroup and this recipe has
    // no opinion. Dropping it from `icon` is the one visual change (a background on an
    // `<svg>` glyph).
    expect(everyEmittedClass()).not.toContain("bg-muted");
    expect(pickerVariants.variantKeys).not.toContain("isReadOnly");
  });
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
    // Two rows share the box and only the end row grows, so the call site adds the class.
    expect(slots.input()).not.toContain("flex-1");
    expect(slots.input({ class: "flex-1" }).split(/\s+/)).toContain("flex-1");
  });

  it("strips Calendar's card border and pays RangeCalendar's inset", () => {
    // Calendar's root carries its own `p-2` and a card border the popover already
    // provides; RangeCalendar's root is bare by design above a
    // `p-0` dialog, so the range arm is where that inset comes from.
    expect(pickerVariants().calendar()).toBe("border-none");
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

  it("gives the dialog its two-pane row only when the caller has presets", () => {
    // The two-pane layout is the divider plus the column gap and the trailing inset; a
    // lone calendar takes none of it, and the slot must be empty rather than absent so
    // the call site can hand the class through unconditionally.
    expect(pickerVariants({ hasPresets: true }).pane().split(/\s+/)).toEqual(
      expect.arrayContaining(["flex", "gap-x-3", "divide-x", "pr-3", "pb-3"])
    );
    // tailwind-variants collapses an empty slot face to `undefined`, which is what the
    // call site wants: React then omits the attribute rather than emitting `class=""`.
    expect(pickerVariants({ hasPresets: false }).pane()).toBeUndefined();
    expect(pickerVariants().pane()).toBeUndefined();
  });
});
