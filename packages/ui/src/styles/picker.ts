import { tv } from "tailwind-variants";

import { controlInsetMdClass } from "./control-inset";

/**
 * The one date-picker recipe (date-picker.md §4, date-range-picker.md §4). Package-private
 * — no entry re-exports it, and the interim tier has no public recipe surface. It lives
 * here rather than beside the components because every RAC entry keeps its recipe in
 * `src/styles/` (range-calendar.md §8.2's locked ruling).
 *
 * **One recipe, not two** (spec 08 user story 5; date-picker.md §8.11 / date-range-picker.md
 * §8.13, 2026-09-03). `datePickerVariants` and `dateRangePickerVariants` were shape-matched
 * by ruling and then maintained apart, with byte-identical `base`, `icon`, `dialog` and
 * `isReadOnly` arms; every difference between them is a consequence of one fact — whether
 * the field box holds one segment row or two — so that fact became the `range` axis and the
 * two recipes became this one.
 *
 * A picker owns no colour of its own: every surface comes from the parts it composes
 * (`fieldGroupVariants` for the field box, the private popover/dialog for the overlay,
 * Calendar/RangeCalendar for the grid). What is left is layout, the overrides the
 * composition needs — `dialog` strips the styled Dialog's padding, `calendar` reconciles the
 * two grids' own insets — and the range separator's colour.
 *
 * **The read-only fill is not here.** It used to be `bg-muted` on `group` *and* on `icon`,
 * while `fieldGroupVariants` has carried an `isReadOnly` axis all along and DateField
 * already routed the state through it. The fill is now painted once, by the FieldGroup, from the picker's own
 * `isReadOnly`. Dropping it from `icon` is a deliberate visual change: a background on the
 * `<svg>` glyph never belonged there and it is the one screenshot difference this
 * consolidation makes (date-picker.md §8.11, 2026-09-03).
 *
 * There is deliberately no `size` axis — `fieldGroupVariants` already pins
 * `h-(--control-h-md)` for the whole field family (conventions.md ruling 2). The `input`
 * slot is `controlInsetMdClass` so the segmented rows match Input at both densities;
 * `py-*` stays off the height-pinned box.
 */
export const pickerVariants = tv({
  slots: {
    /** The RAC picker root: label, field box, help text and popover in a column. */
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- date-picker.md §4: label/field stack gap is layout, not a control rung
    base: "group flex flex-col gap-1",
    /** The private FieldGroup around the segment row(s) and the trigger. */
    group: "w-auto",
    /** A public DateInput inside the field box. */
    input: controlInsetMdClass,
    /**
     * The en-dash between a range's two rows: decorative, `aria-hidden`, and the only slot
     * with a colour of its own. date-range-picker.md §8.4 renames the reference's two
     * primitive grays to role tokens; the forced-colors fallbacks are kept verbatim so the
     * glyph survives a high-contrast theme. Empty on the single-date axis, which renders no
     * separator at all.
     */
    separator: "",
    /**
     * The CalendarBlank glyph in the trigger button. A plain `size-4`: `buttonVariants`
     * only sizes `svg:not([class*='size-'])`, so this class already wins on its own and an
     * `!` would just be noise.
     */
    icon: "size-4 transition-colors",
    /**
     * The styled Dialog inside the popover. Both padding utilities are needed: the dialog
     * recipe sets `p-6` on its base and `p-4` under `[data-placement]`, which is exactly the
     * popover case.
     */
    dialog: "p-0 [[data-placement]>&]:p-0",
    /** The public Calendar / RangeCalendar inside the dialog — see the `range` axis. */
    calendar: "",
    /**
     * The row inside the dialog holding the optional preset pane and the calendar. Empty
     * unless there are presets: a lone calendar is a single pane, so it must not inherit the
     * divider, the column gap or the trailing inset the two-pane layout needs
     * (date-picker.md §2).
     */
    pane: "",
  },
  variants: {
    /**
     * Whether the field box holds two segment rows and a separator. Every geometric
     * difference between the two pickers hangs off this one axis.
     */
    range: {
      false: {
        // One row that grows to fill the box.
        group: "min-w-[180px]",
        input: "flex min-w-[150px] flex-1",
        // Calendar's own root carries `p-2`; the popover already provides the card chrome.
        calendar: "border-none",
      },
      true: {
        group: "min-w-[208px]",
        // Two rows share the box and only the end row grows, so the call site — not this
        // slot — adds `flex-1` to the end input (date-range-picker.md §4).
        separator:
          "text-foreground group-disabled:text-muted-foreground forced-colors:text-[ButtonText] forced-colors:group-disabled:text-[GrayText]",
        // RangeCalendar's root is deliberately bare (range-calendar.md §8.5 — "the picker
        // dialog supplies the chrome") and this dialog is `p-0`, so the grid would otherwise
        // sit flush against the popover border.
        calendar: "p-2",
      },
    },
    /**
     * Whether the caller handed over a preset pane that would actually paint. The call site
     * decides that (`presetGroup={showPresets && <Group />}` collapses to `false`, not
     * `undefined`), so this axis takes the answer, never the node. Single-date only.
     */
    hasPresets: {
      true: {
        pane: "flex gap-x-3 divide-x pr-3 pb-3",
      },
      false: {
        pane: "",
      },
    },
  },
  defaultVariants: {
    range: false,
    hasPresets: false,
  },
});
