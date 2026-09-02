import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { dateRangePickerVariants } from "../../styles/date-range-picker";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

/** Every class the recipe can emit, across both faces of its single axis. */
function everyEmittedClass(): string {
  return [false, true]
    .flatMap((isReadOnly) => {
      const slots = dateRangePickerVariants({ isReadOnly });
      return [
        slots.base(),
        slots.group(),
        slots.input(),
        slots.separator(),
        slots.icon(),
        slots.dialog(),
        slots.calendar(),
      ];
    })
    .join(" ");
}

describe("dateRangePickerVariants", () => {
  it("lays the root out as a labelled column and floors the field box width (§2/§4)", () => {
    const slots = dateRangePickerVariants();
    expect(slots.base()).toBe("group flex flex-col gap-1");
    expect(slots.group()).toContain("min-w-[208px]");
    expect(slots.group()).toContain("w-auto");
  });

  it("keeps the shared input slot flexless so only the end row grows (§4)", () => {
    const { input } = dateRangePickerVariants();
    expect(input()).toContain("px-(--control-px-md)");
    expect(input()).toContain("[font-size:var(--control-text)]");
    expect(input()).toContain("[line-height:var(--control-leading)]");
    expect(input()).not.toContain("py-");
    expect(input()).not.toContain("text-sm");
    expect(input()).not.toContain("px-2");
    expect(input()).not.toContain("flex-1");
    // The end row is the same slot plus the growth class the call site adds.
    expect(input({ class: "flex-1" }).split(/\s+/)).toContain("flex-1");
  });

  it("colours the separator with role tokens and keeps the forced-colors fallbacks (§5/§8.4)", () => {
    const separator = dateRangePickerVariants().separator();
    expect(separator).toContain("text-foreground");
    expect(separator).toContain("group-disabled:text-muted-foreground");
    expect(separator).toContain("forced-colors:text-[ButtonText]");
    expect(separator).toContain("forced-colors:group-disabled:text-[GrayText]");
  });

  it("sizes the trigger glyph explicitly rather than leaning on the Button default (§8.6)", () => {
    const icon = dateRangePickerVariants().icon();
    expect(icon).toContain("size-4");
    expect(icon).toContain("transition-colors");
  });

  it("strips the styled Dialog's padding in both of its forms (§4)", () => {
    const dialog = dateRangePickerVariants().dialog();
    expect(dialog).toContain("p-0");
    // The dialog recipe re-pads itself inside a positioned popover, so that arm is
    // overridden too — otherwise the calendar would sit in 1rem of dead space.
    expect(dialog).toContain("[[data-placement]>&]:p-0");
  });

  it("pays the padding the bare RangeCalendar root does not carry (§4)", () => {
    // RangeCalendar renders borderless and padless by design (range-calendar.md §8.5),
    // and the dialog above it is p-0, so this slot is where the inset comes from.
    expect(dateRangePickerVariants().calendar()).toBe("p-2");
  });

  it("fills the field box and the trigger glyph with muted only while read-only (§4)", () => {
    expect(dateRangePickerVariants({ isReadOnly: true }).group()).toContain("bg-muted");
    expect(dateRangePickerVariants({ isReadOnly: true }).icon()).toContain("bg-muted");
    expect(dateRangePickerVariants({ isReadOnly: false }).group()).not.toContain("bg-muted");
    expect(dateRangePickerVariants({ isReadOnly: false }).icon()).not.toContain("bg-muted");
    expect(dateRangePickerVariants().group()).not.toContain("bg-muted");
  });

  it("emits exactly the read-only axis, no control rung, and no raw palette", () => {
    expect(dateRangePickerVariants.variantKeys).toEqual(["isReadOnly"]);
    expect(everyEmittedClass()).not.toContain("--control-h-");
    expect(everyEmittedClass()).not.toMatch(RAW_PALETTE_RE);
  });

  it("owns no surface, border or focus ring of its own (§5)", () => {
    const emitted = everyEmittedClass();
    expect(emitted).not.toContain("bg-card");
    expect(emitted).not.toContain("border-input");
    expect(emitted).not.toContain("ring-ring");
    expect(emitted).not.toContain("shadow-md");
  });
});

describe("date-range-picker package surface", () => {
  it("is a subpath-only react-aria entry publishing exactly the one documented name", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/date-range-picker");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["DateRangePicker"]);
    expect(entry?.sourceFile).toBe("src/react-aria/date-range-picker.ts");
    expect(root?.runtimeExports).not.toContain("DateRangePicker");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/date-range-picker");
    // The bare path stays reserved for the base-ui successor (§1 Do-not).
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("date-range-picker");
  }, 30_000);
});
