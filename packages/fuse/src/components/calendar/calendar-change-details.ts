/**
 * What a change callback receives beside the new value: the gesture behind the change, the DOM
 * event and element it came from, and `cancel()`, which stops the component applying it. The
 * shape follows Base UI's change event details, so it reads the same as the details of Base UI's
 * own parts.
 *
 * @template TReason - The gestures that can cause the change.
 */
export type CalendarChangeEventDetails<TReason extends string> = {
  /** The gesture behind the change. */
  readonly reason: TReason;
  /** The DOM event behind the change. */
  readonly event: Event;
  /** The element the gesture happened on. */
  readonly trigger: Element | undefined;
  /**
   * Stops the component applying the change. Call it inside the callback; what it prevents is on
   * each callback.
   */
  readonly cancel: () => void;
  /** Whether `cancel()` was called. */
  readonly isCanceled: boolean;
};

/** The gestures that select a day: a press, or Enter or Space. */
export type CalendarValueChangeReason = "day-press" | "keyboard";

/**
 * Why a selected value would fail the calendar's own rules: before the minimum
 * (`"rangeUnderflow"`), after the maximum (`"rangeOverflow"`), or a day `isDateUnavailable`
 * refuses (`"unavailable"`). The bound words are `ValidityState`'s, as every date component in
 * the tier reports them.
 */
export type CalendarValidationError = "rangeUnderflow" | "rangeOverflow" | "unavailable";

/**
 * The details of a value change.
 *
 * @template TReason - The gestures that can cause the change.
 */
export type CalendarValueChangeEventDetails<TReason extends string> = CalendarChangeEventDetails<TReason> & {
  /**
   * The new value's validation error, worked out when called, or `null` when it passes. A day the
   * user presses always passes, since the calendar refuses the others; a picker's typed value can
   * fail.
   */
  readonly getValidationError: () => CalendarValidationError | null;
};

/**
 * Details for a change, with a working `cancel()`.
 *
 * @template TReason - The gestures that can cause the change.
 * @template TExtras - The callback's own fields, such as `getValidationError`.
 * @param reason - The gesture.
 * @param event - The DOM event.
 * @param trigger - The element the gesture happened on.
 * @param extras - The callback's own fields.
 * @returns The details.
 */
export function createChangeEventDetails<TReason extends string, TExtras extends object>(
  reason: TReason,
  event: Event,
  trigger: Element | undefined,
  extras: TExtras
): CalendarChangeEventDetails<TReason> & TExtras {
  let canceled = false;
  return {
    ...extras,
    reason,
    event,
    trigger,
    cancel() {
      canceled = true;
    },
    get isCanceled() {
      return canceled;
    },
  };
}
