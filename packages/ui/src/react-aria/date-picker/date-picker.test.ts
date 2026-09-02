import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { datePickerVariants } from "../../styles/date-picker";
import { datePickerStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

/** Every class the recipe can emit, across both faces of both axes. */
function everyEmittedClass(): string {
  return [false, true]
    .flatMap((isReadOnly) =>
      [false, true].flatMap((hasPresets) => {
        const slots = datePickerVariants({ isReadOnly, hasPresets });
        return [
          slots.base(),
          slots.group(),
          slots.input(),
          slots.icon(),
          slots.dialog(),
          slots.calendar(),
          slots.pane(),
        ];
      })
    )
    .join(" ");
}

const PRESETS_COPY = {
  "nb-NO": "Datoforvalg",
  "sv-SE": "Datumalternativ",
  "en-US": "Date presets",
  "fi-FI": "Päivämäärän pikavalinnat",
} as const;

describe("date-picker dictionary", () => {
  it("owns the locked datePicker.presets copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(datePickerStrings.getStringForLocale("presets", locale), locale).toBe(PRESETS_COPY[locale]);
    }
  });

  it("carries no key beyond the single row accessibility.md §4.1 assigns to DatePicker", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(datePickerStrings.getStringsForLocale(locale)), locale).toEqual(["presets"]);
    }
  });
});

describe("datePickerVariants", () => {
  it("lays the root out as a labelled column and floors the field box width (§2/§4)", () => {
    const slots = datePickerVariants();
    expect(slots.base()).toBe("group flex flex-col gap-1");
    expect(slots.group()).toContain("min-w-[180px]");
    expect(slots.group()).toContain("w-auto");
    expect(slots.input()).toContain("flex-1");
    expect(slots.input()).toContain("min-w-[150px]");
    expect(slots.input()).toContain("px-(--control-px-md)");
    expect(slots.input()).toContain("[font-size:var(--control-text)]");
    expect(slots.input()).toContain("[line-height:var(--control-leading)]");
    expect(slots.input()).not.toContain("py-");
    expect(slots.input()).not.toContain("text-sm");
    expect(slots.input()).not.toContain("px-2");
  });

  it("strips the styled Dialog's padding in both of its forms (§4)", () => {
    const dialog = datePickerVariants().dialog();
    expect(dialog).toContain("p-0");
    // The dialog recipe re-pads itself inside a positioned popover, so that arm is
    // overridden too — otherwise the calendar would sit in 1rem of dead space.
    expect(dialog).toContain("[[data-placement]>&]:p-0");
  });

  it("strips Calendar's card border because the popover already provides chrome (§4)", () => {
    expect(datePickerVariants().calendar()).toBe("border-none");
  });

  it("gives the dialog its two-pane row only when the caller has presets (§2/§4)", () => {
    // The two-pane layout is the divider plus the column gap and the trailing inset; a
    // lone calendar takes none of it, and the slot must be empty rather than absent so
    // the call site can hand the class through unconditionally.
    expect(datePickerVariants({ hasPresets: true }).pane().split(/\s+/)).toEqual(
      expect.arrayContaining(["flex", "gap-x-3", "divide-x", "pr-3", "pb-3"])
    );
    // tailwind-variants collapses an empty slot face to `undefined`, which is what the
    // call site wants: React then omits the attribute rather than emitting `class=""`.
    expect(datePickerVariants({ hasPresets: false }).pane()).toBeUndefined();
    expect(datePickerVariants().pane()).toBeUndefined();
  });

  it("sizes the trigger glyph without an important flag — buttonVariants defers to it", () => {
    // `buttonVariants` only sizes `svg:not([class*='size-'])`, so a plain `size-4` on the
    // glyph already wins and the important flag it used to carry was noise. Asserted as an
    // exact match rather than by grepping for the flagged class: spelling that class
    // anywhere Tailwind scans would put the utility back into `styles.css`.
    expect(datePickerVariants().icon()).toBe("size-4 transition-colors");
  });

  it("fills the field box and the trigger glyph with muted only while read-only (§4)", () => {
    expect(datePickerVariants({ isReadOnly: true }).group()).toContain("bg-muted");
    expect(datePickerVariants({ isReadOnly: true }).icon()).toContain("bg-muted");
    expect(datePickerVariants({ isReadOnly: false }).group()).not.toContain("bg-muted");
    expect(datePickerVariants({ isReadOnly: false }).icon()).not.toContain("bg-muted");
    expect(datePickerVariants().group()).not.toContain("bg-muted");
  });

  it("emits exactly the two documented axes, no control rung, and no raw palette", () => {
    expect(datePickerVariants.variantKeys).toEqual(["isReadOnly", "hasPresets"]);
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

describe("date-picker package surface", () => {
  it("is a subpath-only react-aria entry publishing exactly the three documented names", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/date-picker");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["DatePicker", "DatePickerPresetGroup", "DatePickerPresetItem"]);
    expect(entry?.sourceFile).toBe("src/react-aria/date-picker.ts");
    for (const name of ["DatePicker", "DatePickerPresetGroup", "DatePickerPresetItem"]) {
      expect(root?.runtimeExports).not.toContain(name);
    }
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/date-picker");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("date-picker");
  }, 30_000);
});
