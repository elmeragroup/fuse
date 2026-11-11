// The range rules behind RangeCalendar, outside React: what pressing a day does with and without an
// anchor, how far a range may reach from its anchor past unavailable days, where keyboard focus
// goes after anchoring, what a commit on blur or an outside press selects, the view of the range a
// calendar shows, and each day's flags in it. Pure: it takes Temporal values and returns them, so
// the rules are unit-tested without React. The rules reproduce React Aria's `useRangeCalendarState` (react-stately) and the
// keyboard step of `useCalendarCell` (react-aria).

import { checkBounds } from "../../temporal/bounds";
import { temporal } from "../../temporal/temporal";
import type {
  CalendarValidationError,
  CalendarValueChangeEventDetails,
} from "../calendar/calendar-change-details";
import { dayFlags, NO_DAY_FLAGS } from "../calendar/calendar-context";
import type { CalendarDayFlag, CalendarDayFlags } from "../calendar/calendar-context";
import { clampDay } from "../calendar/calendar-dates";
import type { DayBounds } from "../calendar/calendar-dates";

/** A selected range: this runtime's `Temporal.PlainDate`s, `start` never after `end`. */
export type RangeCalendarValue = {
  /** The first day. */
  readonly start: Temporal.PlainDate;
  /** The last day, the same as `start` for a one-day range. */
  readonly end: Temporal.PlainDate;
};

/**
 * The gestures that complete a range: a second day pressed or chosen with Enter or Space, a press
 * outside the days and month buttons, or focus leaving the calendar while a range is open. A press
 * on an outside element that takes focus, such as a mouse press on a button in most browsers,
 * moves focus first and reports `"focus-out"`, while a touch tap on it reports `"outside-press"`;
 * treat the two reasons alike.
 */
export type RangeCalendarValueChangeReason = "day-press" | "keyboard" | "outside-press" | "focus-out";

/** What `RangeCalendar.Root`'s `onValueChange` receives beside the new range. */
export type RangeCalendarRootValueChangeEventDetails =
  CalendarValueChangeEventDetails<RangeCalendarValueChangeReason>;

/** A range of days, `start` never after `end`: the rules' name for `RangeCalendarValue`. */
export type DayRange = RangeCalendarValue;

/** A day `isDateUnavailable` refuses, given the anchor. */
export type RangeUnavailable = (date: Temporal.PlainDate) => boolean;

/** What the range rules read from the Root. */
export type RangeRules = {
  /** The Root's own first and last selectable days, before an anchor narrows them. */
  readonly bounds: DayBounds;
  /**
   * The Root's `isDateUnavailable` with the anchor it is asked about, or `undefined` when the
   * Root has none. `unavailableFor` binds it to each anchor.
   */
  readonly isDateUnavailable:
    | ((date: Temporal.PlainDate, anchor: Temporal.PlainDate | null) => boolean)
    | undefined;
  /** How many months show, which is how far from the anchor an unavailable day narrows a range. */
  readonly visibleMonths: number;
};

/**
 * Two days as a range, earlier first, as React Aria's `makeRange` orders a selection that ends
 * before its anchor.
 *
 * @param a - One end.
 * @param b - The other end.
 * @returns The range.
 */
export function orderedRange(a: Temporal.PlainDate, b: Temporal.PlainDate): DayRange {
  return temporal().PlainDate.compare(b, a) < 0 ? { start: b, end: a } : { start: a, end: b };
}

/**
 * The Root's `isDateUnavailable` asked about one anchor, or `undefined` without one.
 *
 * @param rules - The Root's rules.
 * @param anchor - The anchor, or `null` when no range is being chosen.
 * @returns A one-argument test.
 */
export function unavailableFor(
  rules: RangeRules,
  anchor: Temporal.PlainDate | null
): RangeUnavailable | undefined {
  const { isDateUnavailable } = rules;
  return isDateUnavailable === undefined ? undefined : (date) => isDateUnavailable(date, anchor);
}

/** The nearest unavailable day from `anchor` in one direction, within `months`, stepped back once. */
function runEnd(
  anchor: Temporal.PlainDate,
  isUnavailable: RangeUnavailable,
  months: number,
  step: 1 | -1
): Temporal.PlainDate | undefined {
  const { PlainDate } = temporal();
  const limit = anchor.add({ months: step * months });
  let day = anchor.add({ days: step });
  while (step * PlainDate.compare(day, limit) <= 0 && !isUnavailable(day)) {
    day = day.add({ days: step });
  }
  return isUnavailable(day) ? day.subtract({ days: step }) : undefined;
}

/**
 * The first and last selectable days once a range is anchored: the Root's bounds narrowed to the
 * run of available days around the anchor, so a range never spans an unavailable day. Like React
 * Aria's `nextUnavailableDate`, it looks `visibleMonths` months each way from the anchor and at
 * the one day past that; an unavailable day further out leaves that side at the Root's bound.
 *
 * @param rules - The Root's rules.
 * @param anchor - The anchor.
 * @returns The bounds while the anchor stands.
 */
export function anchoredBounds(rules: RangeRules, anchor: Temporal.PlainDate): DayBounds {
  const isUnavailable = unavailableFor(rules, anchor);
  if (isUnavailable === undefined) {
    return rules.bounds;
  }
  const { PlainDate } = temporal();
  const before = runEnd(anchor, isUnavailable, rules.visibleMonths, -1);
  const after = runEnd(anchor, isUnavailable, rules.visibleMonths, 1);
  const { min, max } = rules.bounds;
  return {
    min: before === undefined || (min !== undefined && PlainDate.compare(min, before) > 0) ? min : before,
    max: after === undefined || (max !== undefined && PlainDate.compare(max, after) < 0) ? max : after,
  };
}

/** Whether a day lies inside the bounds. */
function within(date: Temporal.PlainDate, bounds: DayBounds): boolean {
  return checkBounds(date, bounds) === "within";
}

/**
 * The day a press selects: the pressed day pulled into the bounds, then walked back past
 * unavailable days to the first available one, but not before `from`. React Aria's
 * `constrainValue` then `previousAvailableDate`, with `from` the first visible day.
 *
 * @param date - The day pressed or committed.
 * @param bounds - The bounds in force.
 * @param isUnavailable - The unavailable test in force.
 * @param from - The earliest day the walk may reach.
 * @returns The day, or `null` when every day back to `from` is unavailable.
 */
function selectableDay(
  date: Temporal.PlainDate,
  bounds: DayBounds,
  isUnavailable: RangeUnavailable | undefined,
  from: Temporal.PlainDate
): Temporal.PlainDate | null {
  const { PlainDate } = temporal();
  let day = clampDay(date, bounds);
  if (isUnavailable === undefined) {
    return day;
  }
  while (PlainDate.compare(day, from) >= 0) {
    if (!isUnavailable(day)) {
      return day;
    }
    day = day.subtract({ days: 1 });
  }
  return null;
}

/**
 * Where keyboard focus goes after Enter or Space anchors a range: the next day, or the day before
 * when the next one is out of the anchored bounds, or the anchor itself when both are. React Aria
 * moves focus this way so a keyboard user sees a range start rather than a single selected day.
 *
 * @param anchor - The new anchor.
 * @param bounds - The bounds while the anchor stands, from `anchoredBounds`.
 * @returns The day to focus.
 */
function keyboardAnchorFocus(anchor: Temporal.PlainDate, bounds: DayBounds): Temporal.PlainDate {
  const next = anchor.add({ days: 1 });
  if (within(next, bounds)) {
    return next;
  }
  const previous = anchor.subtract({ days: 1 });
  return within(previous, bounds) ? previous : anchor;
}

/** What selecting a day does. */
export type RangePress =
  /**
   * The day becomes the anchor, focus moves to `focus`, and `bounds` are the bounds while the
   * anchor stands, from `anchoredBounds`.
   */
  | {
      readonly kind: "anchored";
      readonly anchor: Temporal.PlainDate;
      readonly focus: Temporal.PlainDate;
      readonly bounds: DayBounds;
    }
  /** The day completes the range from the anchor. */
  | { readonly kind: "completed"; readonly range: DayRange };

/**
 * What selecting a day does: without an anchor it anchors a range; with one it completes the
 * range from the anchor to the day, earlier day first. A keyboard anchor moves focus on by a day
 * (`keyboardAnchorFocus`); a pointer anchor leaves it on the day. The day is one the user may
 * select, inside the bounds in force and available, as the parts hand the Root only such a day.
 *
 * @param anchor - The current anchor, or `null`.
 * @param date - The day selected.
 * @param rules - The Root's rules.
 * @param keyboard - Whether Enter or Space selected it.
 * @returns The outcome.
 */
export function pressDay(
  anchor: Temporal.PlainDate | null,
  date: Temporal.PlainDate,
  rules: RangeRules,
  keyboard: boolean
): RangePress {
  if (anchor !== null) {
    return { kind: "completed", range: orderedRange(anchor, date) };
  }
  const bounds = anchoredBounds(rules, date);
  const focus = keyboard ? keyboardAnchorFocus(date, bounds) : date;
  return { kind: "anchored", anchor: date, focus, bounds };
}

/** What a range left open does when focus leaves the calendar or the user presses outside it. */
export type RangeCommitBehavior = "select" | "reset";

/**
 * What a commit does with an open range: `"select"` completes it at the focused or hovered day,
 * pulled into the anchored bounds and walked back past unavailable days (`selectableDay`);
 * `"reset"` drops the anchor and keeps the previous value. A select whose day walks back to
 * nothing drops the anchor too.
 *
 * @param anchor - The anchor.
 * @param focused - The focused or hovered day, which may be unavailable.
 * @param rules - The Root's rules.
 * @param from - The first visible day, which the walk back stops at.
 * @param behavior - The Root's `commitBehavior`.
 * @returns The range to select, or `null` to drop the anchor.
 */
export function commitRange(
  anchor: Temporal.PlainDate,
  focused: Temporal.PlainDate,
  rules: RangeRules,
  from: Temporal.PlainDate,
  behavior: RangeCommitBehavior
): DayRange | null {
  if (behavior === "reset") {
    return null;
  }
  const day = selectableDay(focused, anchoredBounds(rules, anchor), unavailableFor(rules, anchor), from);
  return day === null ? null : orderedRange(anchor, day);
}

/**
 * Why a selected range fails the Root's rules: its start before the minimum (`"rangeUnderflow"`),
 * its end after the maximum (`"rangeOverflow"`), or an end `isDateUnavailable` refuses with no
 * anchor (`"unavailable"`), in Calendar's `ValidityState` words. React Aria checks only the ends,
 * so a value spanning an unavailable day passes.
 *
 * @param range - The range.
 * @param rules - The Root's rules.
 * @returns The error, or `null` when the range passes.
 */
export function rangeValidationError(range: DayRange, rules: RangeRules): CalendarValidationError | null {
  if (checkBounds(range.start, rules.bounds) === "underflow") {
    return "rangeUnderflow";
  }
  if (checkBounds(range.end, rules.bounds) === "overflow") {
    return "rangeOverflow";
  }
  const isUnavailable = unavailableFor(rules, null);
  return isUnavailable !== undefined && (isUnavailable(range.start) || isUnavailable(range.end))
    ? "unavailable"
    : null;
}

/** The range a calendar shows in one state, which every day's flags and name read. */
export type RangeView = {
  /** The range shown: the one being chosen, or the value; `null` for neither. */
  readonly range: DayRange | null;
  /** Whether a range is being chosen: an anchor stands. */
  readonly choosing: boolean;
  /** Whether the value, shown with no anchor, fails the Root's rules (`rangeValidationError`). */
  readonly invalid: boolean;
};

/**
 * The range a calendar shows: from the anchor to the focused or hovered day while one is being
 * chosen, otherwise the value, with whether that value is invalid.
 *
 * @param state - The anchor, the focused day and the value.
 * @param rules - The Root's rules.
 * @returns The view.
 */
export function rangeView(
  state: {
    readonly anchor: Temporal.PlainDate | null;
    readonly focused: Temporal.PlainDate | null;
    readonly value: DayRange | null;
  },
  rules: RangeRules
): RangeView {
  const { anchor, value } = state;
  return {
    range: anchor === null ? value : orderedRange(anchor, state.focused ?? anchor),
    choosing: anchor !== null,
    invalid: anchor === null && value !== null && rangeValidationError(value, rules) !== null,
  };
}

/** Where a day sits in a range: outside it, its start, a day between, its end, or a one-day range's day. */
export type RangeDayPlace = "none" | "start" | "middle" | "end" | "start-end";

/**
 * Where a day sits in a range.
 *
 * @param date - The day.
 * @param range - The range, or `null`.
 * @returns The day's place.
 */
export function rangeDayPlace(date: Temporal.PlainDate, range: DayRange | null): RangeDayPlace {
  const { PlainDate } = temporal();
  if (range === null || PlainDate.compare(date, range.start) < 0 || PlainDate.compare(date, range.end) > 0) {
    return "none";
  }
  const isStart = date.equals(range.start);
  const isEnd = date.equals(range.end);
  if (isStart && isEnd) {
    return "start-end";
  }
  if (isStart) {
    return "start";
  }
  return isEnd ? "end" : "middle";
}

/** How a range shows: as a value, as an invalid value, or as a range being chosen. */
type RangeFace = "value" | "invalid" | "highlight";

/** A place's flags in each face: selected and in range, its ends, and the face's own flag. */
function placeFlags(...ends: CalendarDayFlag[]) {
  const days: CalendarDayFlag[] = ["selected", "in-range", ...ends];
  return {
    value: dayFlags(days),
    invalid: dayFlags([...days, "invalid"]),
    highlight: dayFlags([...days, "highlighted"]),
  };
}

/** Every place's flags in each face, built once. */
const RANGE_DAY_FLAGS = {
  start: placeFlags("selection-start"),
  middle: placeFlags(),
  end: placeFlags("selection-end"),
  "start-end": placeFlags("selection-start", "selection-end"),
} as const satisfies Record<Exclude<RangeDayPlace, "none">, Record<RangeFace, CalendarDayFlags>>;

/** The face a view shows its range in. */
function rangeFace(view: RangeView): RangeFace {
  if (view.choosing) {
    return "highlight";
  }
  return view.invalid ? "invalid" : "value";
}

/**
 * One day's flags in a range view, as React Aria's range cells mark them: every day of the range
 * `selected` and `in-range`, its ends `selection-start` and `selection-end`, a range being chosen
 * `highlighted` and an invalid value `invalid`. An unavailable day inside a valid range is not
 * selected; an invalid range marks every day of it.
 *
 * @param view - The range view.
 * @param date - The day.
 * @param isUnavailable - The unavailable test in force, or `undefined`.
 * @returns The day's flags.
 */
export function rangeDayFlags(
  view: RangeView,
  date: Temporal.PlainDate,
  isUnavailable: RangeUnavailable | undefined
): CalendarDayFlags {
  const place = rangeDayPlace(date, view.range);
  if (place === "none" || (!view.invalid && isUnavailable?.(date) === true)) {
    return NO_DAY_FLAGS;
  }
  return RANGE_DAY_FLAGS[place][rangeFace(view)];
}

/**
 * Whether a day's name starts with the whole range: an end of a value shown with no anchor.
 *
 * @param view - The range view.
 * @param date - The day.
 * @returns `true` on the value's first or last day.
 */
export function namesRange(view: RangeView, date: Temporal.PlainDate): boolean {
  const { range } = view;
  return !view.choosing && range !== null && (date.equals(range.start) || date.equals(range.end));
}
