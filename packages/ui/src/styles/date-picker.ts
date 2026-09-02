import { tv } from "tailwind-variants";

/**
 * DatePicker's slotted recipe (date-picker.md §4). Package-private — no entry
 * re-exports it, and the interim tier has no public recipe surface.
 *
 * The picker owns no colour of its own: every surface comes from the parts it composes
 * (`fieldGroupVariants` for the field box, the private popover/dialog for the overlay,
 * Calendar for the grid), so these slots are layout plus the two overrides the
 * composition needs — `dialog` strips the styled Dialog's padding, `calendar` strips
 * Calendar's card border because the popover already provides the chrome (§4/§5).
 *
 * Two axes (§4): `isReadOnly` puts `bg-muted` on the field box and the trigger icon, and
 * `hasPresets` turns the dialog's single pane into the divided two-pane row. There is
 * deliberately no `size` axis — `fieldGroupVariants` already pins
 * `h-(--control-h-md)` for the whole field family (conventions.md ruling 2). The `input`
 * slot reads `--control-px-md` and the control type pair so the segmented row matches
 * Input at both densities; `py-*` stays off the height-pinned box.
 */
export const datePickerVariants = tv({
  slots: {
    /** The RAC DatePicker root: label, field box, help text and popover in a column. */
    base: "group flex flex-col gap-1",
    /** The private FieldGroup around the segments and the trigger. */
    group: "w-auto min-w-[180px]",
    /** The public DateInput inside the field box. */
    input:
      "flex min-w-[150px] flex-1 px-(--control-px-md) [font-size:var(--control-text)] [line-height:var(--control-leading)]",
    /**
     * The CalendarBlank glyph in the trigger button. A plain `size-4`: `buttonVariants`
     * only sizes `svg:not([class*='size-'])`, so this class already wins on its own and
     * an `!` would just be noise.
     */
    icon: "size-4 transition-colors",
    /**
     * The styled Dialog inside the popover. Both padding utilities are needed: the
     * dialog recipe sets `p-6` on its base and `p-4` under `[data-placement]`, which is
     * exactly the popover case.
     */
    dialog: "p-0 [[data-placement]>&]:p-0",
    /** The public Calendar inside the dialog — the popover owns the card chrome. */
    calendar: "border-none",
    /**
     * The row inside the dialog holding the optional preset pane and the calendar. Empty
     * unless there are presets: a lone calendar is a single pane, so it must not inherit
     * the divider, the column gap or the trailing inset the two-pane layout needs (§2).
     */
    pane: "",
  },
  variants: {
    isReadOnly: {
      true: {
        group: "bg-muted",
        icon: "bg-muted",
      },
      false: {
        group: "",
        icon: "",
      },
    },
    /**
     * Whether the caller handed over a preset pane that would actually paint. The call
     * site decides that (`presetGroup={showPresets && <Group />}` collapses to `false`,
     * not `undefined`), so this axis takes the answer, never the node.
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
    isReadOnly: false,
    hasPresets: false,
  },
});
