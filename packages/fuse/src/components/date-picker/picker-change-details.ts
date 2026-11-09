// The change details both date pickers pass: Calendar's details shape (`reason`, `event`,
// `trigger`, `cancel()`, `isCanceled`), which follows Base UI's, built by Calendar's factory. Open
// changes carry Base UI Popover's own reasons beside the pickers' own.

import type { PopoverRoot } from "@base-ui/react/popover";

import type {
  CalendarChangeEventDetails,
  CalendarValidationError,
} from "../calendar/calendar-change-details";

/**
 * Why a picker's popup opens or closes: Base UI Popover's reasons (`"trigger-press"`,
 * `"outside-press"`, `"escape-key"`, `"focus-out"`, …), `"keyboard"` for Alt+ArrowDown in the
 * group or Enter on a day that closes it, `"day-press"` for a pressed day that closes it, and
 * `"preset-press"` for a double-clicked preset that closes it.
 */
export type DatePickerOpenChangeReason =
  | PopoverRoot.ChangeEventReason
  | "keyboard"
  | "day-press"
  | "preset-press";

/**
 * Ask a picker Root to open or close the popup, through its `onOpenChange`.
 *
 * @returns Whether the popup changed: `false` when it already was so, or a commit or `onOpenChange` canceled.
 */
export type PickerOpenRequest = (
  open: boolean,
  reason: DatePickerOpenChangeReason,
  event: Event,
  trigger: Element | undefined
) => boolean;

/**
 * What a picker's change callback receives beside the new value or open state: the gesture, its
 * DOM event and element, and `cancel()`, whose effect each callback states. The same shape as
 * Calendar's and DateInput's details.
 *
 * @template TReason - The gestures that can cause the change.
 */
export type DatePickerChangeEventDetails<TReason extends string> = CalendarChangeEventDetails<TReason>;

/** What `onOpenChange` receives beside the new open state. */
export type DatePickerOpenChangeEventDetails = DatePickerChangeEventDetails<DatePickerOpenChangeReason>;

/**
 * What `DatePicker.Presets`' `onValueChange` receives beside the pressed preset's key. `reason` is
 * `"preset-press"`; canceling keeps the checked preset as it was.
 */
export type DatePickerPresetsValueChangeEventDetails = DatePickerChangeEventDetails<"preset-press">;

/**
 * Why a picker value fails its rules, as `getValidationError()` reports it: Calendar's words,
 * `"rangeUnderflow"`, `"rangeOverflow"` and `"unavailable"`.
 */
export type DatePickerValidationError = CalendarValidationError;
