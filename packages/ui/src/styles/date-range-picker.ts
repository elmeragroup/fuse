import { tv } from "tailwind-variants";

/**
 * DateRangePicker's slotted recipe (date-range-picker.md §4). Package-private — no
 * entry re-exports it, and the interim tier has no public recipe surface.
 *
 * Shape-matched to `datePickerVariants` (§8.5): the reference styled every element
 * inline with no recipe at all, and the parity ruling replaced that with these slots.
 * The picker owns no surface of its own — `fieldGroupVariants` paints the field box, the
 * private popover paints the overlay, RangeCalendar paints the grid — so what is left is
 * layout, the two overrides the composition needs, and the separator's own colour.
 *
 * Two deliberate differences from the single-date recipe, both forced by the parts:
 *  - `input` carries no `flex-1`/`min-w`: two segment rows share the box, and only the
 *    end row grows (§4 — the call site adds `flex-1` to the end input).
 *  - `calendar` pays the padding that the single-date recipe gets for free. Calendar's
 *    own root carries `p-2`; RangeCalendar's root is deliberately bare (range-calendar.md
 *    §8.5 — "the picker dialog supplies the chrome"), and this dialog is `p-0`, so the
 *    grid would otherwise sit flush against the popover border.
 *
 * The single axis is `isReadOnly` (§4): `bg-muted` on the field box and the trigger
 * icon. There is deliberately no `size` axis — `fieldGroupVariants` already pins the
 * `md` control rung for the whole field family (conventions.md ruling 2), so this recipe
 * reads no `--control-*` variable and restates no box metric.
 */
export const dateRangePickerVariants = tv({
  slots: {
    /** The RAC DateRangePicker root: label, field box, help text and popover in a column. */
    base: "group flex flex-col gap-1",
    /** The private FieldGroup around both segment rows, the separator and the trigger. */
    group: "w-auto min-w-[208px]",
    /**
     * One public DateInput inside the field box. The end row adds `flex-1` at the call
     * site so the trailing gap belongs to the end date, not to the separator (§2/§4).
     */
    input: "text-sm px-2 py-1.5",
    /**
     * The en-dash between the two rows: decorative, `aria-hidden`, and the only slot
     * with a colour of its own. §8.4 renames the reference's two primitive grays (the
     * resting and `group-disabled:` pair) to role tokens; the forced-colors fallbacks
     * are kept verbatim so the glyph survives a high-contrast theme.
     */
    separator:
      "text-foreground group-disabled:text-muted-foreground forced-colors:text-[ButtonText] forced-colors:group-disabled:text-[GrayText]",
    /** The CalendarBlank glyph in the trigger button. */
    icon: "size-4 transition-colors",
    /**
     * The styled Dialog inside the popover. Both padding utilities are needed: the
     * dialog recipe sets `p-6` on its base and `p-4` under `[data-placement]`, which is
     * exactly the popover case.
     */
    dialog: "p-0 [[data-placement]>&]:p-0",
    /** The public RangeCalendar inside the dialog — see the note above on `p-2`. */
    calendar: "p-2",
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
  },
  defaultVariants: {
    isReadOnly: false,
  },
});
