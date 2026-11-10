"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { parseTemporal } from "../../temporal/temporal-value";
import type { TemporalInput, TemporalValue } from "../../temporal/temporal-value";
import { firstDayOfWeek } from "../../temporal/week-info";
import type { IsoWeekday } from "../../temporal/week-info";
import { isThemeDevelopment } from "../../theme/validate-theme";
import { createChangeEventDetails } from "./calendar-change-details";
import type { CalendarValueChangeEventDetails, CalendarValueChangeReason } from "./calendar-change-details";
import { CalendarRootContext, createSelectionOwner, dayFlags, NO_DAY_FLAGS } from "./calendar-context";
import type { CalendarRootContextValue, CalendarSettings, CalendarSharedState } from "./calendar-context";
import { boundDay, dayValidationError, visibleMonthCount } from "./calendar-dates";
import type { CalendarPageBehavior, DayBounds } from "./calendar-dates";
import { createCalendarStore, useCalendarSelector } from "./calendar-store";
import { calendarVariants } from "./calendar-variants";
import { initialSharedState, useCalendarNavigation } from "./use-calendar-navigation";
import type { CalendarVisibleRangeChangeHandler } from "./use-calendar-navigation";

const styles = calendarVariants();

const SELECTED = dayFlags(["selected"]);
const SELECTED_INVALID = dayFlags(["selected", "invalid"]);

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

/** What `Calendar.Root`'s `onValueChange` receives beside the new day. */
export type CalendarRootValueChangeEventDetails = CalendarValueChangeEventDetails<CalendarValueChangeReason>;

/** The state `Calendar.Root` shares with its `render` callback and writes as data attributes. */
export type CalendarRootState = {
  /** Whether nothing in the calendar responds. */
  readonly disabled: boolean;
  /** Whether the value cannot change. */
  readonly readonly: boolean;
  /** Whether the value is a day the calendar would refuse: out of bounds or unavailable. */
  readonly invalid: boolean;
};

/** `Calendar.Root` takes a `div`'s props, Base UI's `render` and the calendar's own. */
export type CalendarRootProps = Omit<
  useRender.ComponentProps<"div", CalendarRootState>,
  "defaultValue" | "onChange"
> & {
  /**
   * The selected day, when the parent owns it: a `Temporal.PlainDate` from any implementation, or
   * its ISO text (`"2026-10-12"`), the form a server component passes across the boundary. A
   * date-time or zoned value selects its own wall-clock day. `null` selects nothing.
   */
  value?: Temporal.PlainDate | string | null;
  /** The day selected first, when the calendar owns its value. Takes what `value` takes. */
  defaultValue?: Temporal.PlainDate | string | null;
  /**
   * Called when the user selects a day, by pressing it or with Enter or Space, with the day as
   * this runtime's `Temporal.PlainDate`. `details.reason` is `"day-press"` or `"keyboard"`.
   * Canceling with `details.cancel()` keeps the value unchanged; focus stays on the day.
   */
  onValueChange?: (value: Temporal.PlainDate, details: CalendarRootValueChangeEventDetails) => void;
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
   * The first selectable day: a PlainDate, PlainDateTime or ZonedDateTime from any
   * implementation, or its ISO text. A date-time bound counts from its own wall-clock day. Days
   * before it are disabled, never focusable, and focus clamps to it.
   */
  minValue?: TemporalInput;
  /** The last selectable day, taking what `minValue` takes. Days after it are disabled. */
  maxValue?: TemporalInput;
  /**
   * Days the user may focus but not select, such as fully booked ones. Return `true` to refuse a
   * day. Keep the function's identity stable across renders, since every day re-renders when it
   * changes.
   */
  isDateUnavailable?: (date: Temporal.PlainDate) => boolean;
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

/** A day from a calendar prop. */
function parseDay(input: TemporalInput, prop: string): Temporal.PlainDate {
  const parsed = parseTemporal(input);
  if (parsed._tag === "err") {
    throw new TypeError(`Calendar.Root ${prop}: ${parsed.error.message}`);
  }
  return boundDay(parsed.value);
}

/** A bound from a calendar prop, keeping its kind for the day it falls on. */
function parseBound(input: TemporalInput | undefined, prop: string): TemporalValue | undefined {
  if (input === undefined) {
    return undefined;
  }
  const parsed = parseTemporal(input);
  if (parsed._tag === "err") {
    throw new TypeError(`Calendar.Root ${prop}: ${parsed.error.message}`);
  }
  return parsed.value;
}

/** The text a value prop prints, the key its parse is memoized by. */
function inputKey(input: TemporalInput | null | undefined): string | null | undefined {
  return input == null ? input : String(input);
}

type CalendarState = CalendarSharedState & {
  /** The selected day: the controlled value, mirrored, or the calendar's own. */
  readonly value: Temporal.PlainDate | null;
};

/**
 * A calendar that selects one day: the months, their day grids and the buttons that page them.
 * It is a `group` named by `aria-label` or `aria-labelledby`, and each grid's name starts with
 * that name. Values are `Temporal.PlainDate`s; it reads `globalThis.Temporal`, so a host without
 * native Temporal imports `@elmeragroup/fuse/temporal-polyfill` once.
 *
 * Today is marked from the first client effect on and moves at midnight; a server render marks
 * no today. A calendar with neither `value` nor `defaultValue` opens on today's month, so it shows
 * its months from that effect on.
 *
 * @throws TypeError naming the prop when `value`, `defaultValue`, `minValue` or `maxValue` is text
 *   that is not an ISO date, a host defect.
 */
export function CalendarRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  visibleMonths: visibleMonthsProp = 1,
  pageBehavior = "visible",
  minValue,
  maxValue,
  isDateUnavailable,
  disabled = false,
  readOnly = false,
  firstDayOfWeek: firstDayProp,
  onVisibleRangeChange,
  className,
  render,
  ref: refProp,
  ...props
}: CalendarRootProps): ReactElement {
  const { locale, timeZone } = useLocale();
  const controlled = valueProp !== undefined;
  const valueKey = inputKey(valueProp);
  const minKey = inputKey(minValue);
  const maxKey = inputKey(maxValue);

  // Each prop is parsed once per printed value, so a parent passing a new object for the same day
  // re-renders nothing below.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed by the printed value
  const value = useMemo(() => (valueProp == null ? null : parseDay(valueProp, "value")), [valueKey]);
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed by the printed value
  const minBound = useMemo(() => parseBound(minValue, "minValue"), [minKey]);
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed by the printed value
  const maxBound = useMemo(() => parseBound(maxValue, "maxValue"), [maxKey]);
  const bounds = useMemo(
    (): DayBounds => ({
      min: minBound === undefined ? undefined : boundDay(minBound),
      max: maxBound === undefined ? undefined : boundDay(maxBound),
    }),
    [minBound, maxBound]
  );
  const visibleMonths = visibleMonthCount(visibleMonthsProp);
  // Once per value, from an effect, rather than on every render the prop stays wrong.
  useEffect(() => {
    if (visibleMonths !== visibleMonthsProp && isThemeDevelopment()) {
      console.warn(
        `Calendar.Root: visibleMonths ${String(visibleMonthsProp)} is not a whole number from 1, so it shows ${String(visibleMonths)}.`
      );
    }
  }, [visibleMonths, visibleMonthsProp]);
  const ariaLabel = props["aria-label"];
  const ariaLabelledBy = props["aria-labelledby"];
  const settings = useMemo(
    (): CalendarSettings => ({
      locale,
      bounds,
      isDateUnavailable,
      disabled,
      readOnly,
      firstDay: firstDayProp === undefined ? firstDayOfWeek(locale) : ISO_WEEKDAY[firstDayProp],
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

  const [store] = useState(() => {
    const initial = controlled ? value : defaultValue == null ? null : parseDay(defaultValue, "defaultValue");
    return createCalendarStore<CalendarState>({ ...initialSharedState(initial, settings), value: initial });
  });

  // A controlled value reaches the store before paint. Focus and the view stay where they are, as
  // in React Aria: a new value from the parent selects it without moving the user.
  useLayoutEffect(() => {
    const state = store.get();
    if (
      controlled &&
      !(state.value === value || (state.value !== null && value?.equals(state.value) === true))
    ) {
      store.set({ ...state, value });
    }
  }, [store, controlled, value]);

  const latest = useRef({ settings, onValueChange, controlled });
  useLayoutEffect(() => {
    latest.current = { settings, onValueChange, controlled };
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const { actions } = useCalendarNavigation(store, settings, timeZone, onVisibleRangeChange, rootRef);
  // Calendar's selection owner: one day, `selected` on it and `invalid` when it fails validation.
  // It has no preview, so the pointer selects nothing. The parts pass `select` only a day the
  // user may select.
  const selection = useMemo(
    () =>
      createSelectionOwner(store, {
        dayFlags(state, date) {
          if (state.value === null || !state.value.equals(date)) {
            return NO_DAY_FLAGS;
          }
          return dayValidationError(state.value, settings) === null ? SELECTED : SELECTED_INVALID;
        },
        select(date, reason, event, trigger) {
          const { onValueChange: report, controlled: isControlled } = latest.current;
          const details = createChangeEventDetails(reason, event, trigger, {
            getValidationError: () => dayValidationError(date, latest.current.settings),
          });
          report?.(date, details);
          if (details.isCanceled) {
            return;
          }
          const state = store.get();
          store.set({ ...state, value: isControlled ? state.value : date, focused: date });
        },
        // One day has no preview, so the pointer changes no flags.
        hover: () => undefined,
      }),
    [store, settings]
  );
  const invalid = useCalendarSelector(
    store,
    (state) => state.value !== null && dayValidationError(state.value, settings) !== null
  );

  const context = useMemo(
    (): CalendarRootContextValue => ({ store, settings, actions, selection }),
    [store, settings, actions, selection]
  );
  const state = useMemo(
    (): CalendarRootState => ({ disabled, readonly: readOnly, invalid }),
    [disabled, readOnly, invalid]
  );

  const element = useRender({
    defaultTagName: "div",
    render,
    ref: refProp === undefined ? rootRef : [rootRef, refProp],
    state,
    props: {
      "data-slot": "calendar",
      ...mergeProps<"div">({ role: "group", className: cn(styles.root(), className) }, props),
    },
  });
  return <CalendarRootContext value={context}>{element}</CalendarRootContext>;
}
