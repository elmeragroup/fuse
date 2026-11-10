import type {
  CalendarChangeEventDetails,
  CalendarValidationError,
} from "../calendar/calendar-change-details";

/** The gestures that change a date input's value: typing or keys, clearing every segment, pasting. */
export type DateInputValueChangeReason = "input-change" | "input-clear" | "input-paste";

/**
 * What `DateInput.Root`'s `onValueChange` receives beside the new value: the gesture behind the
 * change, the DOM event (a key, input, blur or paste event) and the segment it came from,
 * `cancel()`, which stops the input applying it, and the new value's validation error. The shape
 * is Calendar's change event details, which follow Base UI's; Calendar's `createChangeEventDetails`
 * builds them.
 */
export type DateInputValueChangeEventDetails = CalendarChangeEventDetails<DateInputValueChangeReason> & {
  /**
   * The new value's validation error against the input's bounds and `isDateUnavailable`, worked
   * out when called, or `null` when it passes: Calendar's words, `"rangeUnderflow"`,
   * `"rangeOverflow"` or `"unavailable"`. A typed value commits even when it fails, as React
   * Aria's does; the field then reports it invalid.
   */
  readonly getValidationError: () => CalendarValidationError | null;
};
