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
 * The single axis is `isReadOnly` (§4): `bg-muted` on the field box and the trigger
 * icon. There is deliberately no `size` axis — `fieldGroupVariants` already pins the
 * `md` control rung for the whole field family (conventions.md ruling 2), so this recipe
 * reads no `--control-*` variable and restates no box metric.
 */
export const datePickerVariants = tv({
  slots: {
    /** The RAC DatePicker root: label, field box, help text and popover in a column. */
    base: "group flex flex-col gap-1",
    /** The private FieldGroup around the segments and the trigger. */
    group: "w-auto min-w-[180px]",
    /** The public DateInput inside the field box. */
    input: "text-sm flex min-w-[150px] flex-1 px-2 py-1.5",
    /** The CalendarBlank glyph in the trigger button. */
    icon: "size-4! transition-colors",
    /**
     * The styled Dialog inside the popover. Both padding utilities are needed: the
     * dialog recipe sets `p-6` on its base and `p-4` under `[data-placement]`, which is
     * exactly the popover case.
     */
    dialog: "p-0 [[data-placement]>&]:p-0",
    /** The public Calendar inside the dialog — the popover owns the card chrome. */
    calendar: "border-none",
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
