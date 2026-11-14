"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { createChangeEventDetails } from "./calendar-change-details";
import type { CalendarValueChangeEventDetails, CalendarValueChangeReason } from "./calendar-change-details";
import { CalendarRootContext, createSelectionOwner, dayFlags, NO_DAY_FLAGS } from "./calendar-context";
import type { CalendarRootContextValue, CalendarSharedState } from "./calendar-context";
import { dayValidationError } from "./calendar-dates";
import { useCalendarBounds, useCalendarSettings, useDayProp, useVisibleMonthCount } from "./calendar-input";
import type { CalendarViewProps } from "./calendar-input";
import { createCalendarStore, useCalendarSelector } from "./calendar-store";
import { calendarVariants } from "./calendar-variants";
import { initialSharedState, useCalendarNavigation } from "./use-calendar-navigation";

const styles = calendarVariants();

const SELECTED = dayFlags(["selected"]);
const SELECTED_INVALID = dayFlags(["selected", "invalid"]);

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

type RootElementProps = Omit<
  useRender.ComponentProps<"div", CalendarRootState>,
  "defaultValue" | "onChange" | "aria-label" | "aria-labelledby"
>;

/** `Calendar.Root` takes a `div`'s props, Base UI's `render` and the calendar's own. */
export type CalendarRootProps = RootElementProps &
  CalendarViewProps & {
    /**
     * The selected day, when the parent owns it: a `Temporal.PlainDate` from any implementation.
     * A server component cannot pass one, since it reaches the client as ISO text, which the
     * calendar refuses with a `TypeError`: build the value in a client component. `null` selects
     * nothing.
     *
     * Import `@elmeragroup/fuse/temporal-polyfill` on the server and in the browser for engines
     * without `Temporal`, and type-check with TypeScript 6 and an `esnext` lib, as
     * `/quick-start#temporal` shows.
     */
    value?: Temporal.PlainDate | null;
    /**
     * The day selected first, when the calendar owns its value. Takes what `value` takes.
     *
     * With neither `value` nor `defaultValue`, the calendar opens on today's month. Only the first
     * client effect reads the clock, so the server and the hydrating render write each month's
     * frame, the weekday row over six weeks of empty days, hidden from assistive technology, and
     * the calendar hydrates without a mismatch. It keeps that height for a six-week month and
     * shrinks by a row or two for a shorter one. Today is marked from the same effect on, never in
     * a server render, and the mark moves at midnight.
     */
    defaultValue?: Temporal.PlainDate | null;
    /**
     * Called when the user selects a day, by pressing it or with Enter or Space, with the day as
     * this runtime's `Temporal.PlainDate`. `details.reason` is `"day-press"` or `"keyboard"`, and
     * `details.event` and `details.trigger` are the DOM event and the day's button. Canceling
     * with `details.cancel()` keeps the value unchanged; focus stays on the day.
     * `details.getValidationError()` returns `null` here, since the calendar lets the user select
     * only days that pass.
     */
    onValueChange?: (value: Temporal.PlainDate, details: CalendarRootValueChangeEventDetails) => void;
    /**
     * Days the user may focus but not select, such as fully booked ones. Return `true` to refuse a
     * day. Keep the function's identity stable across renders, since every day re-renders when it
     * changes.
     */
    isDateUnavailable?: (date: Temporal.PlainDate) => boolean;
    /**
     * The parts: a `Calendar.Header` with `Calendar.DecrementMonth`,
     * `Calendar.VisibleRangeHeading` and `Calendar.IncrementMonth`, then `Calendar.Months`.
     */
    children?: RootElementProps["children"];
  };

type CalendarState = CalendarSharedState & {
  /** The selected day: the controlled value, mirrored, or the calendar's own. */
  readonly value: Temporal.PlainDate | null;
};

/**
 * A calendar that selects one day: the months, their day grids and the buttons that page them.
 * It is a `group`. It reads `globalThis.Temporal`, so a host without native Temporal imports
 * `@elmeragroup/fuse/temporal-polyfill` once.
 *
 * @throws TypeError naming the prop and the fix when `value`, `defaultValue`, `minValue` or
 *   `maxValue` is a string rather than a Temporal object, a host defect.
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
  const value = useDayProp(valueProp, "Calendar.Root", "value");
  // The default seeds the selection once, below; reading it on every render refuses a string
  // whether the calendar is controlled or the default changed after mount.
  const defaultDay = useDayProp(defaultValue, "Calendar.Root", "defaultValue");
  const bounds = useCalendarBounds(minValue, maxValue, "Calendar.Root");
  const visibleMonths = useVisibleMonthCount(visibleMonthsProp, "Calendar.Root");
  const settings = useCalendarSettings({
    locale,
    bounds,
    isDateUnavailable,
    disabled,
    readOnly,
    firstDayOfWeek: firstDayProp,
    visibleMonths,
    pageBehavior,
    ariaLabel: props["aria-label"],
    ariaLabelledBy: props["aria-labelledby"],
  });

  const [store] = useState(() => {
    const initial = controlled ? value : defaultDay;
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
      // oxlint-disable-next-line react/refs -- `select` reads `latest` when a day is picked, not during render
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
        // One day has no preview, so the pointer changes no flags, and no name prefix or
        // description: a day's own name says it is selected.
        hover: () => undefined,
        dayNamePrefix: () => "",
        dayDescriptionId: undefined,
        multiselectable: false,
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
