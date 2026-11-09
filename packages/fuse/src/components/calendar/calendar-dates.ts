// The date arithmetic behind every calendar Root: which months show, where focus goes for a key,
// what a month button pages to, and whether it may. Pure: it takes Temporal values and returns
// them, so the rules are unit-tested without React. The alignment rules reproduce React Aria's
// `react-stately` calendar utilities (`alignCenter`, `alignStart`, `alignEnd`, `constrainStart`,
// `constrainValue`), which the parity harness in `src/internal/date-tier-parity.browser.test.tsx`
// pins for one month.

import { checkBounds } from "../../temporal/bounds";
import { temporal } from "../../temporal/temporal";
import type { TemporalValue } from "../../temporal/temporal-value";
import type { CalendarValidationError } from "./calendar-change-details";

/** How the month buttons page a multi-month view: by every visible month, or by one. */
export type CalendarPageBehavior = "visible" | "single";

/** The first and last selectable days, each optional. */
export type DayBounds = {
  /** The first selectable day. */
  readonly min: Temporal.PlainDate | undefined;
  /** The last selectable day. */
  readonly max: Temporal.PlainDate | undefined;
};

/** The months a calendar shows: the first, and how many in a row. */
export type VisibleMonths = {
  /** The first visible month. */
  readonly start: Temporal.PlainYearMonth;
  /** How many months show, from 1. */
  readonly count: number;
};

/** A key a day button moves focus with, after the writing direction is resolved. */
export type FocusMove =
  | "previous-day"
  | "next-day"
  | "previous-week"
  | "next-week"
  | "month-start"
  | "month-end"
  | "previous-month"
  | "next-month"
  | "previous-year"
  | "next-year";

/**
 * A month count as one the calendar can show: whole, and at least one. A fraction truncates and a
 * count below one, or one that is not a finite number, becomes one, as Carousel truncates and
 * clamps a requested page.
 *
 * @param requested - The `visibleMonths` prop.
 * @returns The months to show.
 */
export function visibleMonthCount(requested: number): number {
  return Number.isFinite(requested) ? Math.max(1, Math.trunc(requested)) : 1;
}

/**
 * The day a bound of any kind falls on, as a calendar of days compares it: a PlainDate is itself,
 * a date-time or zoned value is the date on its own wall clock. `checkBounds` compares a PlainDate
 * value the same way, so a day is selectable exactly when it lies between these days.
 *
 * @param bound - A bound of any kind.
 * @returns Its day.
 */
export function boundDay(bound: TemporalValue): Temporal.PlainDate {
  return "hour" in bound ? bound.toPlainDate() : bound;
}

/**
 * A day pulled inside the bounds: the first selectable day for one before it, the last for one
 * after it.
 *
 * @param date - The day.
 * @param bounds - The first and last selectable days.
 * @returns The day, or the nearest bound.
 */
export function clampDay(date: Temporal.PlainDate, bounds: DayBounds): Temporal.PlainDate {
  switch (checkBounds(date, bounds)) {
    case "underflow":
      return bounds.min ?? date;
    case "overflow":
      return bounds.max ?? date;
    case "within":
      return date;
  }
}

/** What decides whether the user may select a day: the Root's bounds and `isDateUnavailable`. */
export type DayRules = {
  /** The first and last selectable days. */
  readonly bounds: DayBounds;
  /** Days the user may focus but not select. */
  readonly isDateUnavailable: ((date: Temporal.PlainDate) => boolean) | undefined;
};

/**
 * Why a day fails the calendar's rules, or `null` when the user may select it: before the first
 * selectable day (`"rangeUnderflow"`), after the last (`"rangeOverflow"`), or refused by
 * `isDateUnavailable` (`"unavailable"`). `checkBounds`'s own words map onto `ValidityState`'s here,
 * the one place the calendar names them. The bounds are checked first, so `isDateUnavailable` only
 * sees days inside them.
 *
 * @param date - The day.
 * @param rules - The bounds and `isDateUnavailable`.
 * @returns The error, or `null`.
 */
export function dayValidationError(
  date: Temporal.PlainDate,
  rules: DayRules
): CalendarValidationError | null {
  switch (checkBounds(date, rules.bounds)) {
    case "underflow":
      return "rangeUnderflow";
    case "overflow":
      return "rangeOverflow";
    case "within":
      return rules.isDateUnavailable?.(date) === true ? "unavailable" : null;
  }
}

/** Where a day of the grid stands against the Root's props. */
export type DayStatus = {
  /** Outside the bounds, in a neighbouring month, or in a disabled calendar: never focusable. */
  readonly disabled: boolean;
  /** Refused by `isDateUnavailable`: focusable, never selectable. */
  readonly unavailable: boolean;
};

/**
 * Where a day of the grid stands: disabled when the calendar is, when it belongs to a
 * neighbouring month or when it falls outside the bounds, and otherwise unavailable when
 * `isDateUnavailable` refuses it, by `dayValidationError`'s one check.
 *
 * @param date - The day.
 * @param outsideMonth - Whether the day belongs to a neighbouring month.
 * @param settings - The rules and whether the calendar is disabled.
 * @returns The status.
 */
export function dayStatus(
  date: Temporal.PlainDate,
  outsideMonth: boolean,
  settings: DayRules & { readonly disabled: boolean }
): DayStatus {
  if (settings.disabled || outsideMonth) {
    return { disabled: true, unavailable: false };
  }
  const error = dayValidationError(date, settings);
  return {
    disabled: error === "rangeUnderflow" || error === "rangeOverflow",
    unavailable: error === "unavailable",
  };
}

/** The day focus starts on and the months that show it, from a value or today. */
export type OpenedView = {
  /** The day, clamped to the bounds. */
  readonly focused: Temporal.PlainDate;
  /** The visible months around it. */
  readonly visible: VisibleMonths;
};

/**
 * Where a calendar opens on a day: focus on the day clamped to the bounds, and the months
 * `initialVisibleMonths` centres on it. A Root opened on its value, on today, or re-aligned after
 * its bounds or month count change opens the same way.
 *
 * @param day - The value's day, or today.
 * @param count - How many months show.
 * @param bounds - The first and last selectable days.
 * @returns The focused day and the visible months.
 */
export function openView(day: Temporal.PlainDate, count: number, bounds: DayBounds): OpenedView {
  const focused = clampDay(day, bounds);
  return { focused, visible: initialVisibleMonths(focused, count, bounds) };
}

/**
 * The last visible month.
 *
 * @param visible - The visible months.
 * @returns The month `count - 1` after the first.
 */
export function lastVisibleMonth(visible: VisibleMonths): Temporal.PlainYearMonth {
  return visible.start.add({ months: visible.count - 1 });
}

/**
 * Whether a day falls in one of the visible months.
 *
 * @param visible - The visible months.
 * @param date - The day.
 * @returns `true` when its month is one of them.
 */
export function showsDay(visible: VisibleMonths, date: Temporal.PlainDate): boolean {
  const { PlainYearMonth } = temporal();
  const month = date.toPlainYearMonth();
  return (
    PlainYearMonth.compare(month, visible.start) >= 0 &&
    PlainYearMonth.compare(month, lastVisibleMonth(visible)) <= 0
  );
}

/**
 * A first visible month moved so the view stays inside the bounds where it can: not before the
 * first selectable day's month, and not so late that the last selectable day's month leaves the
 * view's end empty. React Aria's `constrainStart`; the maximum wins when the bounds span fewer
 * months than the view.
 */
function constrainStart(start: Temporal.PlainYearMonth, count: number, bounds: DayBounds) {
  const { PlainYearMonth } = temporal();
  let constrained = start;
  if (bounds.min !== undefined) {
    const earliest = bounds.min.toPlainYearMonth();
    if (PlainYearMonth.compare(constrained, earliest) < 0) {
      constrained = earliest;
    }
  }
  if (bounds.max !== undefined) {
    const latest = bounds.max.toPlainYearMonth().subtract({ months: count - 1 });
    if (PlainYearMonth.compare(constrained, latest) > 0) {
      constrained = latest;
    }
  }
  return constrained;
}

/**
 * The months a calendar opens on: the focused day's month centred in the view, as React Aria's
 * default `selectionAlignment="center"` does (one month before it at three months, none before it
 * at one or two), then kept inside the bounds.
 *
 * @param focused - The day focus starts on, already inside the bounds.
 * @param count - How many months show.
 * @param bounds - The first and last selectable days.
 * @returns The visible months.
 */
export function initialVisibleMonths(
  focused: Temporal.PlainDate,
  count: number,
  bounds: DayBounds
): VisibleMonths {
  const half = Math.floor(count / 2);
  const before = half > 0 && count % 2 === 0 ? half - 1 : half;
  const start = focused.toPlainYearMonth().subtract({ months: before });
  return { start: constrainStart(start, count, bounds), count };
}

/**
 * The visible months once focus moves to a day: unchanged while the day shows; otherwise moved so
 * it shows. `"visible"` pages the way React Aria does, putting the day's month first when focus
 * leaves forward and last when it leaves backward. `"single"` moves the view the fewest months
 * that bring the day in.
 *
 * @param visible - The visible months before the move.
 * @param date - The day focus moves to, inside the bounds.
 * @param behavior - How the view pages.
 * @param bounds - The first and last selectable days.
 * @returns The visible months after the move.
 */
export function monthsShowing(
  visible: VisibleMonths,
  date: Temporal.PlainDate,
  behavior: CalendarPageBehavior,
  bounds: DayBounds
): VisibleMonths {
  if (showsDay(visible, date)) {
    return visible;
  }
  const { PlainYearMonth } = temporal();
  const month = date.toPlainYearMonth();
  const forward = PlainYearMonth.compare(month, visible.start) > 0;
  const lastFirst = month.subtract({ months: visible.count - 1 });
  const start = forward === (behavior === "visible") ? month : lastFirst;
  return { start: constrainStart(start, visible.count, bounds), count: visible.count };
}

/**
 * The day a key moves focus to, before the bounds clamp it. Arrow keys step a day or a week;
 * Home and End go to the focused month's first and last day, as React Aria does; Page Up and Page
 * Down step a month, a year with Shift. A month step keeps the day of the month where it can and
 * otherwise takes the month's last day, so October 31 steps back to September 30.
 *
 * @param focused - The focused day.
 * @param move - The move, its writing direction already resolved.
 * @returns The day the move lands on.
 */
export function movedDay(focused: Temporal.PlainDate, move: FocusMove): Temporal.PlainDate {
  switch (move) {
    case "previous-day":
      return focused.subtract({ days: 1 });
    case "next-day":
      return focused.add({ days: 1 });
    case "previous-week":
      return focused.subtract({ weeks: 1 });
    case "next-week":
      return focused.add({ weeks: 1 });
    case "month-start":
      return focused.with({ day: 1 });
    case "month-end":
      return focused.with({ day: focused.daysInMonth });
    case "previous-month":
      return focused.subtract({ months: 1 });
    case "next-month":
      return focused.add({ months: 1 });
    case "previous-year":
      return focused.subtract({ years: 1 });
    case "next-year":
      return focused.add({ years: 1 });
  }
}

/**
 * The move a key names on a day button, or `undefined` for a key the grid leaves alone. Arrow
 * Left and Right follow the writing direction, so in a right-to-left grid Arrow Left steps
 * forward. Shift turns a month step into a year step and names no other move, so Shift with an
 * arrow, Home or End is left to the browser, as React Aria matches its shortcuts' exact modifiers.
 *
 * @param key - `KeyboardEvent#key`.
 * @param shiftKey - Whether Shift is held.
 * @param direction - Reads the grid's resolved writing direction, asked only for Arrow Left and
 *   Right.
 * @returns The move.
 */
export function focusMoveForKey(
  key: string,
  shiftKey: boolean,
  direction: () => "ltr" | "rtl"
): FocusMove | undefined {
  switch (key) {
    case "PageUp":
      return shiftKey ? "previous-year" : "previous-month";
    case "PageDown":
      return shiftKey ? "next-year" : "next-month";
    default:
      return shiftKey ? undefined : plainMove(key, direction);
  }
}

/** The move a key names without a modifier. */
function plainMove(key: string, direction: () => "ltr" | "rtl"): FocusMove | undefined {
  switch (key) {
    case "ArrowLeft":
      return direction() === "rtl" ? "next-day" : "previous-day";
    case "ArrowRight":
      return direction() === "rtl" ? "previous-day" : "next-day";
    case "ArrowUp":
      return "previous-week";
    case "ArrowDown":
      return "next-week";
    case "Home":
      return "month-start";
    case "End":
      return "month-end";
    default:
      return undefined;
  }
}

/**
 * Whether a month button may page: the month just past the view in that direction holds a
 * selectable day. React Aria's `isNextVisibleRangeInvalid` and `isPreviousVisibleRangeInvalid`.
 *
 * @param visible - The visible months.
 * @param step - `1` for the next page, `-1` for the previous.
 * @param bounds - The first and last selectable days.
 * @returns `true` when the page has a selectable day.
 */
export function canPage(visible: VisibleMonths, step: 1 | -1, bounds: DayBounds): boolean {
  const { PlainDate } = temporal();
  if (step === 1) {
    const firstPast = lastVisibleMonth(visible).add({ months: 1 }).toPlainDate({ day: 1 });
    return bounds.max === undefined || PlainDate.compare(firstPast, bounds.max) <= 0;
  }
  const before = visible.start.subtract({ months: 1 });
  const lastBefore = before.toPlainDate({ day: before.daysInMonth });
  return bounds.min === undefined || PlainDate.compare(lastBefore, bounds.min) >= 0;
}

/** Where a month button's press lands: the new view and the day focus moves to with it. */
export type PageTarget = {
  /** The visible months after the page. */
  readonly visible: VisibleMonths;
  /** The focused day after the page, inside the bounds and the new view. */
  readonly focused: Temporal.PlainDate;
};

/**
 * The view and focused day a month button pages to. The view moves `pageSize` months and stays
 * inside the bounds, and the focused day moves by the same months, clamped to the bounds and then
 * into the view, as React Aria's `focusNextPage` and `focusPreviousPage` do.
 *
 * @param visible - The visible months.
 * @param focused - The focused day.
 * @param step - `1` for the next page, `-1` for the previous.
 * @param pageSize - The months a page moves: every visible month, or one.
 * @param bounds - The first and last selectable days.
 * @returns The page.
 */
export function pageTarget(
  visible: VisibleMonths,
  focused: Temporal.PlainDate,
  step: 1 | -1,
  pageSize: number,
  bounds: DayBounds
): PageTarget {
  const months = step * pageSize;
  const start = constrainStart(visible.start.add({ months }), visible.count, bounds);
  const next = { start, count: visible.count };
  const day = clampDay(focused.add({ months }), bounds);
  if (showsDay(next, day)) {
    return { visible: next, focused: day };
  }
  // The clamp kept the day out of the view, which only a bound inside the view's first or last
  // month can do: take that month's nearest day in the view.
  const { PlainYearMonth } = temporal();
  const edge = PlainYearMonth.compare(day.toPlainYearMonth(), start) < 0 ? start : lastVisibleMonth(next);
  const inView = clampDay(edge.toPlainDate({ day: Math.min(focused.day, edge.daysInMonth) }), bounds);
  return { visible: next, focused: inView };
}
