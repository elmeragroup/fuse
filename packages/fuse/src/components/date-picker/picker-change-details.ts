// The change details both date pickers pass: Calendar's details shape (`reason`, `event`,
// `trigger`, `cancel()`, `isCanceled`), which follows Base UI's, built by Calendar's factory. Open
// changes carry Base UI Popover's own reasons beside the pickers' own.

import type { PopoverRoot } from "@base-ui/react/popover";

import type { TemporalValue } from "../../temporal/temporal-value";
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
 * What a preset sets the picker to, through its `dateValue`: a Temporal value of the picker's kind
 * in `DatePicker.Root`, a `{ start, end }` range of them in `DateRangePicker.Root`.
 */
export type DatePickerPresetValue = TemporalValue | DatePickerPresetRange;

/** A preset's range for `DateRangePicker.Root`: each end a Temporal value of the picker's kind. */
export type DatePickerPresetRange = {
  /** The first value. */
  readonly start: TemporalValue;
  /** The last value. */
  readonly end: TemporalValue;
};

/**
 * Commit a pressed preset's value through the picker Root's cancelable `onValueChange`, with the
 * reason `"preset-press"`.
 *
 * @returns Whether the value applied: `false` when `onValueChange` canceled it.
 */
export type PickerPresetCommit = (event: Event, trigger: Element) => boolean;

/**
 * Read a preset's `dateValue` as the picker Root reads it, while the preset renders, and bind the
 * commit of what it read. A new reader comes with every new kind, so a preset re-reads then.
 *
 * @throws TypeError for a value the Root does not take: text, the other picker's shape, or another
 *   kind than the picker's. A host defect.
 */
export type PickerPresetReader = (value: DatePickerPresetValue) => PickerPresetCommit;

/**
 * Why a picker value fails its rules, as `getValidationError()` reports it: Calendar's words,
 * `"rangeUnderflow"`, `"rangeOverflow"` and `"unavailable"`.
 */
export type DatePickerValidationError = CalendarValidationError;
