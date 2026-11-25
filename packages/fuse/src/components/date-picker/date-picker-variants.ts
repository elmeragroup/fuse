import { cn } from "../../styles/cn";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { fieldEntryClass, fieldReads, fieldSize } from "../../styles/field-size";
import { dateInputShellClass } from "../../styles/inner-corner/date-field";
import { pickerPresetsShellClass } from "../../styles/inner-corner/picker";
import { dataStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { dateBoxFocusRingClass } from "../../styles/utils";
import { buttonVariants } from "../button/button-variants";
import { dateRowScrollClass } from "../date-field/date-input-variants";

/**
 * The date pickers' module-private recipe, shared by DatePicker and DateRangePicker. No entry
 * exports it.
 *
 * - `group` is the field box around the trigger and the segment rows: the shared field chrome at
 *   the field height of its `size`, with the data-target state face (`data-invalid="true"`,
 *   `data-disabled`) and the muted read-only fill (`data-readonly`). The `range` axis lays out two
 *   rows. The box rings through {@link dateBoxFocusRingClass} while a segment in one of its `input`
 *   rows matches `:focus-visible`.
 * - `input` is a `DateInput.Root` inside the box: no chrome of its own, the md control inset and the
 *   text-entry type, so the segments line up with DateField's. It scrolls inline as DateField's box
 *   does, beside the trigger.
 * - `trigger` is the calendar button flush against the box's border: it reads the box's inner
 *   corner and the field's inner square, which keeps it above the 24px target-size floor at both
 *   densities.
 * - `popup` drops Popover's width and padding, since the calendar and the presets pad themselves.
 * - `timeInput` is a time input under the calendar in the popup: a `DateInput.Root` box of its own,
 *   inset as the calendar's shell pads, inside `timeField`, its own Field, which adds no box. A
 *   Field composite of a picker with a time stacks the calendar over its time inputs in
 *   `timeColumn`, and a range's two time inputs side by side in `timeInputs`; a date-only one's
 *   popup holds the calendar alone.
 * - `calendar` is the calendar inside the popup, which is already the card, so it drops its own
 *   border, shadow and fill and keeps the popover's `--surface`. RangeCalendar's root is bare and
 *   the popup pads nothing, so a range calendar pads itself with the small surface tier, as
 *   Calendar's own shell does in the single picker.
 * - `pane` holds the presets beside the calendar: stacked on a phone, side by side from `sm`. The
 *   divider names the border role, the color fuse.css's base-layer default gives every border, so
 *   the role stays beside the divider. The pane takes no padding or gap, so the divider runs edge to
 *   edge across the popover; the preset group and the calendar each carry their own inset.
 * - `presets` / `preset` are the radio group and each preset, a ghost `sm` button around a native
 *   radio, filled while checked and dimmed by the data-target state face while disabled.
 */
export const datePickerVariants = tv({
  slots: {
    root: "flex min-w-0 flex-col",
    group: cn(
      fieldBoxChromeClass,
      fieldReads.height(),
      "flex w-full min-w-[180px] items-center overflow-hidden",
      dataStateFaceClass,
      dateBoxFocusRingClass,
      "data-readonly:bg-muted"
    ),
    input: cn(
      fieldEntryClass,
      dateInputShellClass,
      "flex min-w-0 flex-1 cursor-text items-center self-stretch whitespace-nowrap",
      dateRowScrollClass
    ),
    separator: "px-1 text-foreground forced-colors:text-[ButtonText]",
    trigger: cn("shrink-0 rounded-inner", fieldReads.inner()),
    icon: "size-4",
    popup: "w-auto gap-0 p-0",
    calendar:
      "border-none bg-transparent shadow-none [--surface-muted-foreground:inherit] [--surface:inherit]",
    timeField: "contents",
    timeInput: "mx-(--surface-pad-sm) mb-(--surface-pad-sm) w-auto",
    timeColumn: "flex flex-col",
    timeInputs: "flex flex-wrap",
    pane: "sm:flex-row sm:divide-x sm:divide-y-0 flex flex-col divide-y divide-border",
    presets: cn(pickerPresetsShellClass, "flex flex-col gap-2"),
    preset: cn(
      buttonVariants({ size: "sm", variant: "ghost" }),
      "relative justify-start rounded-inner text-left",
      "data-checked:bg-accent data-checked:text-accent-foreground",
      dataStateFaceClass,
      "has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
    ),
    presetInput: "sr-only",
  },
  variants: {
    size: {
      default: { group: fieldSize({ size: "default" }).box() },
      sm: { group: fieldSize({ size: "sm" }).box() },
    },
    /**
     * Two segment rows and a separator, on one line while they and the trigger fit. Otherwise the
     * line breaks before the first part that does not fit: the trigger alone, or the end row, which
     * the trigger follows. A row is never wider than the box less one trigger, so the separator
     * stays on the start row's line and the trigger fits beside the end row. A row narrower than
     * its segments scrolls. The box is as tall as its lines, and never shorter than the field
     * height. The range Root is a size container, so its own width, not its segments', decides the
     * track it takes. It holds its label, error and description itself, so it takes a field root's
     * gap and error-colored label.
     */
    range: {
      true: {
        root: "group/field @container/picker w-full gap-1 data-invalid:text-error",
        group: cn("h-auto min-w-[208px] flex-wrap", fieldReads.minHeight()),
        input: cn("box-border", fieldReads.besideInner(), "flex-none"),
        calendar: "p-(--surface-pad-sm)",
      },
    },
  },
  defaultVariants: {
    size: "default",
  },
});
