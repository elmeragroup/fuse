import { tv } from "tailwind-variants";

import { controlInsetMdClass } from "./control-inset";

/**
 * Shared layout recipe for the two date pickers. The `range` axis selects one segment
 * row or two; both variants borrow their field box, popup, and grid surfaces from the
 * composed components. FieldGroup owns the read-only fill and pins the md control
 * height, so this recipe adds no size axis or glyph background. The input inset keeps
 * segmented rows aligned with Input at both densities.
 */
export const pickerVariants = tv({
  slots: {
    /** The RAC picker root: label, field box, help text and popover in a column. */
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- label/field stack gap is layout, not a control rung
    base: "group flex flex-col gap-1",
    /** The private FieldGroup around the segment row(s) and the trigger. */
    group: "w-auto",
    /** A public DateInput inside the field box. */
    input: controlInsetMdClass,
    /**
     * The en-dash between a range's two rows: decorative, `aria-hidden`, and the only slot
     * with a colour of its own. It uses role tokens; the forced-colors fallbacks are kept verbatim so the
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
        // slot — adds `flex-1` to the end input.
        separator:
          "text-foreground group-disabled:text-muted-foreground forced-colors:text-[ButtonText] forced-colors:group-disabled:text-[GrayText]",
        // RangeCalendar's root is bare and this dialog is `p-0`, so the grid would otherwise
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
