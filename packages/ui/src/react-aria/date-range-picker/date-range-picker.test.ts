import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { dateRangePickerVariants } from "../../styles/date-range-picker";
import { OVERLAY_CONTAINER_ATTR } from "../internal/overlay-container";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "date-range-picker.tsx"), "utf8");
const recipe = readFileSync(join(packageRoot, "src/styles/date-range-picker.ts"), "utf8");
const facade = readFileSync(join(here, "../date-range-picker.ts"), "utf8");

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

describe("date-range-picker source contract", () => {
  it("is a client module that composes the public parts instead of forking them", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("@elmeragroup/ui/");
    // The segments and the range grid are the shipped public entries, not local copies.
    expect(source).toContain('from "../date-field/date-field"');
    expect(source).toContain('from "../range-calendar/range-calendar"');
    expect(source).not.toContain("CalendarGrid");
    expect(source).not.toContain("CalendarCell");
    expect(source).not.toContain("DateSegment");
    // The field and overlay chrome is the package-private RAC stack (§2).
    expect(source).toContain('from "../internal/popover"');
    expect(source).toContain('from "../internal/field"');
    expect(source).toContain('from "../internal/button"');
  });

  it("takes the popover's dialog from DatePicker's named private one, never raw RAC (§8.2)", () => {
    // The issue's Do-not: the reference imported `Dialog` from react-aria-components and
    // so skipped the cluster's dialog chrome. The styled Dialog reaches this module
    // through DatePicker's PickerDialog, which is what supplies the §7 accessible name.
    expect(source).toContain('import { PickerDialog } from "../date-picker/date-picker"');
    expect(source).toContain("<PickerDialog");
    expect(source).not.toMatch(/^import \{[^}]*\bDialog\b[^}]*\} from "react-aria-components";$/m);
    expect(source).not.toContain('from "../internal/dialog"');
  });

  it("takes the trigger glyph from the Phosphor CalendarBlank roster entry (§8.7)", () => {
    expect(source).toContain('from "../../icons/generated/calendar-blank"');
    expect(source).toContain("CalendarBlank");
    expect(source).not.toContain("lucide");
    expect(source).not.toContain("Icon.Calendar");
  });

  it("adds no preset surface — that stays DatePicker's alone (§3 Do-not)", () => {
    expect(source.toLowerCase()).not.toContain("preset");
    expect(recipe.toLowerCase()).not.toContain("preset");
    expect(facade).not.toContain("Preset");
  });

  it("never spells the overlay-container attribute itself (§6 locked ruling)", () => {
    // The seam belongs to the private popover/modal pair; the picker only has to compose
    // the private Popover for it to apply, and may never restate the DOM string.
    expect(source).not.toContain(OVERLAY_CONTAINER_ATTR);
    expect(recipe).not.toContain(OVERLAY_CONTAINER_ATTR);
  });

  it("keeps the facade a named re-export and the recipe module-private", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("dateRangePickerVariants");
    expect(recipe).not.toContain('"use client"');
  });

  it("authors no data-slot of its own — §6 documents none", () => {
    expect(source).not.toContain("data-slot");
  });

  it("never emits a size axis, a density override, or a hardcoded field-box height", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toContain("h-9");
      expect(text).not.toMatch(/\bsize:\s*\{/);
      expect(text).not.toContain("data-density");
      expect(text).not.toContain("dense:");
      expect(text).not.toContain("comfortable:");
    }
    expect(dateRangePickerVariants.variantKeys).toEqual(["isReadOnly"]);
    // The field box's rung is `fieldGroupVariants`' business, so nothing here reads one.
    expect(everyEmittedClass()).not.toContain("--control-");
  });

  it("never uses primitive gray/white or destructive vocabulary (§8.4)", () => {
    for (const text of [source, recipe]) {
      expect(text).not.toContain("text-gray-");
      expect(text).not.toContain("bg-gray-");
      // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
      expect(text).not.toContain("text-white");
      // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
      expect(text).not.toContain("bg-white");
      expect(text).not.toContain("bg-background");
      expect(text).not.toContain("destructive");
      expect(text).not.toContain("dark:");
      expect(text).not.toMatch(RAW_PALETTE_RE);
    }
    expect(everyEmittedClass()).not.toMatch(RAW_PALETTE_RE);
  });
});

describe("dateRangePickerVariants", () => {
  it("lays the root out as a labelled column and floors the field box width (§2/§4)", () => {
    const slots = dateRangePickerVariants();
    expect(slots.base()).toBe("group flex flex-col gap-1");
    expect(slots.group()).toContain("min-w-[208px]");
    expect(slots.group()).toContain("w-auto");
  });

  it("keeps the shared input slot flexless so only the end row grows (§4)", () => {
    const { input } = dateRangePickerVariants();
    expect(input()).toContain("px-2");
    expect(input()).toContain("py-1.5");
    expect(input()).toContain("text-sm");
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
