// The input boundary every calendar Root shares, and DateInput.Root with it: the props both
// calendar Roots take, date props read from a Temporal value of any implementation, memoized by
// the text they print, the bounds resolved to days, React Aria's weekday names resolved to ISO
// weekdays, and the props resolved into the parts' settings. Each Root names itself in its
// diagnostics.

import { useEffect, useMemo } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import { parseTemporal, valueKind } from "../../temporal/temporal-value";
import type { TemporalValue } from "../../temporal/temporal-value";
import { firstDayOfWeek } from "../../temporal/week-info";
import type { IsoWeekday } from "../../temporal/week-info";
import { isThemeDevelopment } from "../../theme/validate-theme";
import type { CalendarSettings } from "./calendar-context";
import { boundDay, visibleMonthCount } from "./calendar-dates";
import type { CalendarPageBehavior, DayBounds } from "./calendar-dates";
import type { CalendarVisibleRangeChangeHandler } from "./use-calendar-navigation";

/** A weekday as React Aria's `firstDayOfWeek` names it. */
export type CalendarFirstDayOfWeek = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

const ISO_WEEKDAY = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
} as const satisfies Record<CalendarFirstDayOfWeek, IsoWeekday>;

/**
 * The props every calendar Root takes besides its value: the months it shows, its bounds, whether
 * it responds, its first weekday and its paging callback. `Calendar.Root` and `RangeCalendar.Root`
 * both take them, so each is documented once.
 */
export type CalendarViewProps = {
  /**
   * How many months show side by side, wrapping onto new rows when the host is narrow. Pick it
   * from the viewport in the host, such as one month on a phone and two on a desktop. A whole
   * number from 1: a fraction truncates, and anything below 1 or not a finite number shows one
   * month, with a warning in development.
   * @default 1
   */
  visibleMonths?: number;
  /**
   * How the month buttons page a multi-month view, and how far the view moves when the keyboard
   * leaves it: `"visible"` by every visible month, `"single"` by one.
   * @default "visible"
   */
  pageBehavior?: CalendarPageBehavior;
  /**
   * The first selectable day: a Temporal PlainDate, PlainDateTime or ZonedDateTime from any
   * implementation. A date-time bound counts from its own wall-clock day. Days before it are
   * disabled, never focusable, and focus clamps to it.
   */
  minValue?: TemporalValue;
  /** The last selectable day, taking what `minValue` takes. Days after it are disabled. */
  maxValue?: TemporalValue;
  /** Whether nothing in the calendar responds: no day takes focus and the month buttons are disabled. */
  disabled?: boolean;
  /** Whether the user may move around the months but not change the value. */
  readOnly?: boolean;
  /** The weekday each row starts on. Defaults to the locale's: Sunday in en-US, Monday in the Nordic locales. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /**
   * Called when the visible months change by a month button or the keyboard, with the new first
   * month. `details.reason` is `"increment-press"`, `"decrement-press"` or `"keyboard"`.
   * Canceling with `details.cancel()` keeps the months shown: a month button press does nothing,
   * and a key that would page leaves focus on the day it was on.
   */
  onVisibleRangeChange?: CalendarVisibleRangeChangeHandler;
};

/** The Root a diagnostic names. */
export type CalendarOwner = "Calendar.Root" | "RangeCalendar.Root";

/**
 * The error for text that reached a date prop past its types: from plain JavaScript, or from a
 * server component, whose Temporal props React serializes to their ISO text. It names the kind
 * the text prints, when one does, so the fix can be copied.
 */
function textPropError(owner: string, prop: string, text: string): TypeError {
  const parsed = parseTemporal(text);
  const example =
    parsed._tag === "ok"
      ? `, such as Temporal.${valueKind(parsed.value).kind}.from("${text}")`
      : ": a Temporal.PlainDate, PlainDateTime or ZonedDateTime";
  return new TypeError(
    `${owner} ${prop}: received the string "${text}", but date props take a Temporal object${example}. A Temporal value passed from a server component arrives as its ISO text, so build the value in a client component.`
  );
}

/**
 * The text a date prop prints, the key its parse is memoized by, so a parent passing a new object
 * for the same value re-renders nothing below. It is the one guard against text: it refuses a
 * string here, during render and before any memo, so a string throws whatever rendered before it,
 * the equal Temporal value included, and whether or not the prop is controlled.
 *
 * @param input - The prop.
 * @param owner - The Root, named in the error.
 * @param prop - The prop, named in the error.
 * @returns Its text, or the prop itself when absent.
 * @throws TypeError naming the Root, the prop and the fix when the input is a string, a host defect.
 */
export function printedProp(
  input: TemporalValue | null | undefined,
  owner: string,
  prop: string
): string | null | undefined {
  const received: unknown = input;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- prop boundary: text reaches a date prop past its types from plain JavaScript or a server component, and only its runtime type tells it from a Temporal object
  if (typeof received === "string") {
    throw textPropError(owner, prop, received);
  }
  return input == null ? input : String(input);
}

/**
 * The text a date prop printed, read as this runtime's Temporal value of the same kind, so a value
 * from another implementation is accepted. `printedProp` has refused a string before this runs.
 *
 * @param text - The prop's text, from `printedProp`.
 * @param owner - The Root, named in the error.
 * @param prop - The prop, named in the error.
 * @returns The value.
 * @throws TypeError naming the Root, the prop and the text when no kind reads it: a host defect.
 */
export function parseTemporalProp(text: string, owner: string, prop: string): TemporalValue {
  const parsed = parseTemporal(text);
  if (parsed._tag === "err") {
    throw new TypeError(`${owner} ${prop}: ${parsed.error.message}`);
  }
  return parsed.value;
}

/**
 * A Temporal prop parsed once per printed value, so a parent passing a new object for the same
 * value re-renders nothing below.
 *
 * @param input - The prop.
 * @param owner - The Root, named in the error.
 * @param prop - The prop, named in the error.
 * @returns The value, or `null` without one.
 * @throws TypeError as `printedProp` and `parseTemporalProp` do.
 */
export function useTemporalProp(
  input: TemporalValue | null | undefined,
  owner: string,
  prop: string
): TemporalValue | null {
  const key = printedProp(input, owner, prop);
  return useMemo(() => (key == null ? null : parseTemporalProp(key, owner, prop)), [key, owner, prop]);
}

/**
 * The day a calendar date prop names, parsed once per printed value: a date-time or zoned value
 * names its own wall-clock day.
 *
 * @param input - The prop.
 * @param owner - The Root, named in the error.
 * @param prop - The prop, named in the error.
 * @returns The day, or `null` without one.
 * @throws TypeError as `useTemporalProp` does.
 */
export function useDayProp(
  input: TemporalValue | null | undefined,
  owner: CalendarOwner,
  prop: string
): Temporal.PlainDate | null {
  const value = useTemporalProp(input, owner, prop);
  return useMemo(() => (value === null ? null : boundDay(value)), [value]);
}

/** A range prop's ends as `useRangeProp` reads them. */
export type RangePropEnds = {
  readonly start: TemporalValue | null;
  readonly end: TemporalValue | null;
};

/**
 * A range prop's ends, parsed once per printed value: one object while they hold, so a parent
 * passing new objects for the same range changes nothing.
 *
 * @param input - The prop.
 * @param owner - The Root, named in the error.
 * @param prop - The prop, named in the error with the end.
 * @returns The ends, or `null` without a range.
 * @throws TypeError as `useTemporalProp` does, naming the end.
 */
export function useRangeProp(
  input: { readonly start: TemporalValue; readonly end: TemporalValue } | null | undefined,
  owner: string,
  prop: string
): RangePropEnds | null {
  const start = useTemporalProp(input?.start, owner, `${prop}.start`);
  const end = useTemporalProp(input?.end, owner, `${prop}.end`);
  const present = input != null;
  return useMemo(() => (present ? { start, end } : null), [present, start, end]);
}

/**
 * The first and last selectable days from `minValue` and `maxValue`, parsed once per printed value.
 *
 * @param minValue - The Root's `minValue`.
 * @param maxValue - The Root's `maxValue`.
 * @param owner - The Root, named in a parse error.
 * @returns The bounds.
 * @throws TypeError as `useTemporalProp` does.
 */
export function useCalendarBounds(
  minValue: TemporalValue | undefined,
  maxValue: TemporalValue | undefined,
  owner: CalendarOwner
): DayBounds {
  const min = useDayProp(minValue, owner, "minValue") ?? undefined;
  const max = useDayProp(maxValue, owner, "maxValue") ?? undefined;
  return useMemo((): DayBounds => ({ min, max }), [min, max]);
}

/**
 * The weekday each grid row starts on: the prop's, or the locale's.
 *
 * @param locale - The locale.
 * @param prop - The Root's `firstDayOfWeek`.
 * @returns The ISO weekday.
 */
export function resolveFirstDay(
  locale: SupportedLocale,
  prop: CalendarFirstDayOfWeek | undefined
): IsoWeekday {
  return prop === undefined ? firstDayOfWeek(locale) : ISO_WEEKDAY[prop];
}

/**
 * The months a Root shows for its `visibleMonths`: whole and at least one, with a development
 * warning naming the Root when the prop is not. The warning comes from an effect, once per value,
 * rather than on every render the prop stays wrong.
 *
 * @param requested - The Root's `visibleMonths`.
 * @param owner - The Root, named in the warning.
 * @returns The months to show.
 */
export function useVisibleMonthCount(requested: number, owner: CalendarOwner): number {
  const count = visibleMonthCount(requested);
  useEffect(() => {
    if (count !== requested && isThemeDevelopment()) {
      console.warn(
        `${owner}: visibleMonths ${String(requested)} is not a whole number from 1, so it shows ${String(count)}.`
      );
    }
  }, [count, requested, owner]);
  return count;
}

/** What a Root resolves its shared props to before `useCalendarSettings` assembles them. */
export type CalendarSettingsInput = Omit<CalendarSettings, "firstDay"> & {
  /** The Root's `firstDayOfWeek`, or `undefined` for the locale's. */
  readonly firstDayOfWeek: CalendarFirstDayOfWeek | undefined;
};

/**
 * A Root's settings for the shared parts, keeping its identity while every field keeps its value,
 * so the parts re-render only when a setting changes.
 *
 * @param input - The resolved props, with the bounds and `isDateUnavailable` in force.
 * @returns The settings.
 */
export function useCalendarSettings(input: CalendarSettingsInput): CalendarSettings {
  const {
    locale,
    bounds,
    isDateUnavailable,
    disabled,
    readOnly,
    firstDayOfWeek: firstDayProp,
    visibleMonths,
    pageBehavior,
    ariaLabel,
    ariaLabelledBy,
  } = input;
  return useMemo(
    (): CalendarSettings => ({
      locale,
      bounds,
      isDateUnavailable,
      disabled,
      readOnly,
      firstDay: resolveFirstDay(locale, firstDayProp),
      visibleMonths,
      pageBehavior,
      ariaLabel,
      ariaLabelledBy,
    }),
    [
      locale,
      bounds,
      isDateUnavailable,
      disabled,
      readOnly,
      firstDayProp,
      visibleMonths,
      pageBehavior,
      ariaLabel,
      ariaLabelledBy,
    ]
  );
}
