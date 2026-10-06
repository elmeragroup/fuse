import { useState } from "react";

import { getLocalTimeZone, isSameDay, toCalendarDate, today } from "@internationalized/date";
import type { CalendarDate, DateValue } from "@internationalized/date";

/** A range as RAC's DateRangePicker state holds it: either end may still be missing. */
type CommittedRange = { readonly start: DateValue | null; readonly end: DateValue | null };

/**
 * What a picker has committed: a date for DatePicker, a range for DateRangePicker, or
 * nothing yet.
 */
export type CommittedSelection = DateValue | CommittedRange | null | undefined;

function isRange(committed: DateValue | CommittedRange): committed is CommittedRange {
  return "start" in committed;
}

function isSameDate(left: DateValue | null, right: DateValue | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return isSameDay(left, right);
}

/**
 * Whether two committed selections name the same calendar dates. Pickers and their
 * callers rebuild date objects freely, so identity says nothing: an equal value in a
 * fresh object is no change, and a range that keeps its start object but moves its end
 * is one.
 */
function isSameSelection(left: CommittedSelection, right: CommittedSelection): boolean {
  if (!left || !right) {
    return !left && !right;
  }
  if (isRange(left) && isRange(right)) {
    return isSameDate(left.start, right.start) && isSameDate(left.end, right.end);
  }
  if (!isRange(left) && !isRange(right)) {
    return isSameDay(left, right);
  }
  return false;
}

/**
 * The month the popover opens on: the committed date's (or range start's) month, else
 * the placeholder month, else the current month (the today-fallback is kept from the
 * reference).
 */
function focusedMonthFor(
  committed: CommittedSelection,
  placeholderValue: DateValue | null | undefined
): CalendarDate {
  const anchor = committed && isRange(committed) ? committed.start : committed;
  return toCalendarDate(anchor ?? placeholderValue ?? today(getLocalTimeZone()));
}

/**
 * The controlled focus pair a picker hands its popover calendar, plus the `onChange` that
 * tells the sync which commits the calendar made itself. RAC chains it after the picker's
 * own calendar `onChange`, so committing still goes through the picker.
 */
type CommittedMonthFocus = {
  readonly focusedValue: CalendarDate;
  readonly onFocusChange: (date: CalendarDate) => void;
  readonly onChange: (selection: DateValue | CommittedRange) => void;
};

/**
 * The focused date for a picker popover's calendar, month-synced to the picker's committed
 * value: the selected date for DatePicker, the range start for DateRangePicker.
 *
 * The month the grid shows is local state so paging never rewrites the value. Callers read
 * `committed` from the RAC picker state context rather than from `props.value`, which is
 * what makes the sync hold for an uncontrolled `defaultValue` picker as well as a
 * controlled one. Two triggers synchronize the focused date: the popover unmounts its
 * content on close, so the calendar mounts once per open and the `useState` initializer
 * *is* the per-open resync, while the derive-with-reset below follows a value that changes
 * with the dialog still open — a preset pane lives inside the popover. It resyncs during
 * the render that first sees a different committed value rather than in an effect after
 * paint. "Different" is by calendar date, both ends for a range, so a paged month survives
 * an equal value rebuilt as a new object.
 *
 * Only a value from outside the grid moves it: a preset, a typed segment, a controlled
 * update. A commit the calendar made itself is already on screen, with focus on the date
 * the user just picked, which for a range is often in a later month than its start.
 *
 * @param committed - The picker's committed date or range.
 * @param placeholderValue - The placeholder RAC resolved for the calendar, used while nothing is committed.
 * @returns The controlled `focusedValue` and `onFocusChange` pair and the `onChange` to spread onto the calendar.
 */
export function useCommittedMonthFocus(
  committed: CommittedSelection,
  placeholderValue: DateValue | null | undefined
): CommittedMonthFocus {
  const [focusedValue, setFocusedValue] = useState(() => focusedMonthFor(committed, placeholderValue));
  const [lastCommitted, setLastCommitted] = useState(committed);
  // The calendar only ever commits a date or a range, so `null` here means "no commit
  // from the grid is waiting", never "the grid cleared the value".
  const [calendarCommit, setCalendarCommit] = useState<DateValue | CommittedRange | null>(null);
  const isCalendarCommit = calendarCommit !== null && isSameSelection(committed, calendarCommit);

  if (!isSameSelection(committed, lastCommitted)) {
    setLastCommitted(committed);
    setCalendarCommit(null);
    const month = focusedMonthFor(committed, placeholderValue);
    if (!isCalendarCommit && focusedValue.compare(month) !== 0) {
      setFocusedValue(month);
    }
  }

  return { focusedValue, onFocusChange: setFocusedValue, onChange: setCalendarCommit };
}
