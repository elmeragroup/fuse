import { cn } from "../../styles/cn";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { fieldEntryClass, fieldReads, fieldSize } from "../../styles/field-size";
import { dateInputShellClass } from "../../styles/inner-corner/date-field";
import { pickerPresetsShellClass } from "../../styles/inner-corner/picker";
import {
  pickerPaneClass,
  pickerPopupCalendarClass,
  pickerRangeCalendarClass,
  pickerRangeRootClass,
} from "../../styles/picker";
import { dataStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { dataWithinInvalidFocusRingClass, withinFocusRingClass } from "../../styles/utils";
import { buttonVariants } from "../button/button-variants";

/**
 * The date pickers' module-private recipe, shared by DatePicker and DateRangePicker. No entry
 * exports it.
 *
 * - `group` is the field box around the trigger and the segment rows: the shared field chrome at
 *   the field height of its `size`, ringed while a segment has keyboard focus, with the data-target
 *   state face (`data-invalid="true"`, `data-disabled`) and the muted read-only fill
 *   (`data-readonly`). The `range` axis lays out two rows.
 * - `input` is a `DateInput.Root` inside the box: no chrome of its own, the md control inset and the
 *   text-entry type, so the segments line up with DateField's.
 * - `trigger` is the calendar button flush against the box's border: it reads the box's inner
 *   corner and the field's inner square.
 * - `popup` drops Popover's width and padding, since the calendar and the presets pad themselves.
 * - `timeInput` is a time input under the calendar in the popup: a `DateInput.Root` box of its own,
 *   inset as the calendar's shell pads, inside `timeField`, its own Field, which adds no box. A
 *   Field composite of a picker with a time stacks the calendar over its time inputs in
 *   `timeColumn`, and a range's two time inputs side by side in `timeInputs`; a date-only one's
 *   popup holds the calendar alone.
 * - `calendar` is the calendar inside the popup, which is already the card; a range calendar pads
 *   itself with the small surface tier.
 * - `pane` holds the presets beside the calendar: stacked on a phone, side by side from `sm`.
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
      withinFocusRingClass,
      dataWithinInvalidFocusRingClass,
      "data-readonly:bg-muted"
    ),
    input: cn(
      fieldEntryClass,
      dateInputShellClass,
      "flex min-w-0 flex-1 cursor-text items-center self-stretch overflow-hidden whitespace-nowrap"
    ),
    separator: "px-1 text-foreground forced-colors:text-[ButtonText]",
    trigger: cn("shrink-0 rounded-inner", fieldReads.inner()),
    icon: "size-4",
    popup: "w-auto gap-0 p-0",
    calendar: pickerPopupCalendarClass,
    timeField: "contents",
    timeInput: "mx-(--surface-pad-sm) mb-(--surface-pad-sm) w-auto",
    timeColumn: "flex flex-col",
    timeInputs: "flex flex-wrap",
    pane: pickerPaneClass,
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
     * Two segment rows and a separator: one row from 24rem, stacked beside the trigger below it.
     * The range Root holds its label, error and description itself, so it takes a field root's
     * gap and error-coloured label.
     */
    range: {
      true: {
        root: cn(pickerRangeRootClass, "group/field gap-1 data-invalid:text-error"),
        group: "min-w-[208px] flex-wrap @max-[24rem]/picker:h-auto",
        input: "flex-none",
        calendar: pickerRangeCalendarClass,
      },
    },
  },
  defaultVariants: {
    size: "default",
  },
});
