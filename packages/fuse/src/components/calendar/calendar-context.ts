// The contract between a calendar Root and the parts every calendar shares. A Root (Calendar's
// single date here, RangeCalendar's range in its own module) owns a store whose state extends
// `CalendarSharedState`, resolves its props into `CalendarSettings`, supplies the navigation
// actions (`useCalendarNavigation`) and is the selection owner (`CalendarSelectionOwner`). The
// shared parts read only this module, so a Root with another selection model reuses them whole:
// it writes its own owner, and the parts render whatever day flags that owner reports.

import { createContext, use } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import type { IsoWeekday } from "../../temporal/week-info";
import type { CalendarValueChangeReason } from "./calendar-change-details";
import type { CalendarPageBehavior, DayBounds, FocusMove, VisibleMonths } from "./calendar-dates";
import { useCalendarSelector } from "./calendar-store";
import type { ReadableCalendarStore } from "./calendar-store";

/** The state every calendar Root's store holds, whatever it selects. */
export type CalendarSharedState = {
  /**
   * The visible months, or `null` until today is known: a calendar with no value has no month to
   * show before its first effect reads the clock.
   */
  readonly visible: VisibleMonths | null;
  /** The day the grid's single tab stop is on, always inside `visible`. `null` with `visible`. */
  readonly focused: Temporal.PlainDate | null;
  /** Today in the Root's time zone, or `null` before the first effect, as on the server. */
  readonly today: Temporal.PlainDate | null;
  /**
   * Whether DOM focus follows `focused`: set by a keyboard move, so the focused day's button takes
   * focus once it renders, also after its month remounts; cleared by a month button press and by
   * focus leaving the calendar.
   */
  readonly focusRequest: boolean;
  /** Whether keyboard focus is on a day, which quiets the visible-range live region. */
  readonly gridFocused: boolean;
  /**
   * Whether the user has paged the view, with a month button or a key that leaves the visible
   * months. The visible-range live region stays quiet until then, so the months a calendar opens
   * on, hydrates to or re-aligns to are never announced.
   */
  readonly paged: boolean;
};

/**
 * Every day flag, in the order `dayFlags` writes them. The `CalendarDayFlag` union is read from
 * this list, so the order holds every flag by construction.
 */
const DAY_FLAGS = [
  "selected",
  "selection-start",
  "selection-end",
  "in-range",
  "highlighted",
  "invalid",
] as const;

/**
 * One fact about a day's place in the selection. The day button writes each flag that holds as a
 * bare `data-<flag>` attribute and shares it with its `render` callback as a boolean, and the
 * gridcell is `aria-selected` when `selected` holds:
 *
 * - `selected`: the day is part of the value; the gridcell is `aria-selected`.
 * - `selection-start` / `selection-end`: the first or last day of a range value or preview.
 * - `in-range`: a day between a range's ends, them included.
 * - `highlighted`: a day inside a range that is being chosen, as the pointer or focus previews it.
 * - `invalid`: the selection fails validation on this day; the button is `aria-invalid`.
 *
 * Calendar reports only `selected` and `invalid`; RangeCalendar reports the rest.
 */
export type CalendarDayFlag = (typeof DAY_FLAGS)[number];

declare const dayFlagsBrand: unique symbol;

/**
 * A day's flags as one primitive, so a per-day selector that returns it re-renders the day only
 * when a flag changes. Build it with `dayFlags`; read it once per day with `dayFlagState`.
 * Internal to the parts: a render callback reads the booleans of `dayFlagState`.
 */
export type CalendarDayFlags = string & { readonly [dayFlagsBrand]: true };

/**
 * A day's flags in their fixed order, as one primitive.
 *
 * @param flags - The flags that hold, in any order, repeats allowed.
 * @returns The flags.
 */
export function dayFlags(flags: Iterable<CalendarDayFlag>): CalendarDayFlags {
  const present = new Set(flags);
  // SAFETY: the brand only marks text this function wrote from CalendarDayFlag names.
  return DAY_FLAGS.filter((flag) => present.has(flag)).join(" ") as CalendarDayFlags;
}

/** A day with no flags. */
export const NO_DAY_FLAGS: CalendarDayFlags = dayFlags([]);

/** A day's flags as the booleans of its render state, each flag's name in camel case. */
export type CalendarDayFlagState = {
  /** Whether the day is part of the value. */
  readonly selected: boolean;
  /** Whether the day is the first of a range value or preview. */
  readonly selectionStart: boolean;
  /** Whether the day is the last of a range value or preview. */
  readonly selectionEnd: boolean;
  /** Whether the day lies between a range's ends, them included. */
  readonly inRange: boolean;
  /** Whether the day lies inside a range that is being chosen. */
  readonly highlighted: boolean;
  /** Whether the selection fails validation on this day. */
  readonly invalid: boolean;
};

/** The one mapping between a flag and its render-state field. */
const DAY_FLAG_FIELDS = {
  selected: "selected",
  "selection-start": "selectionStart",
  "selection-end": "selectionEnd",
  "in-range": "inRange",
  highlighted: "highlighted",
  invalid: "invalid",
} as const satisfies Record<CalendarDayFlag, keyof CalendarDayFlagState>;

/**
 * A day's flags as the booleans of its render state: `selected`, `selectionStart`,
 * `selectionEnd`, `inRange`, `highlighted` and `invalid`. The one decoder of `CalendarDayFlags`;
 * the gridcell calls it once per day and shares the result with its button.
 *
 * @param flags - The day's flags.
 * @returns One boolean for each flag.
 */
export function dayFlagState(flags: CalendarDayFlags): CalendarDayFlagState {
  const present = new Set(flags.split(" "));
  // SAFETY: DAY_FLAG_FIELDS names one field for each flag, and the six flags' fields are the six
  // fields of CalendarDayFlagState, so the entries build exactly that object.
  return Object.fromEntries(
    DAY_FLAGS.map((flag) => [DAY_FLAG_FIELDS[flag], present.has(flag)])
  ) as CalendarDayFlagState;
}

/** A render-state attribute writer, in the shape of Base UI's `stateAttributesMapping`. */
type BooleanStateAttribute = (value: boolean) => Record<string, string> | null;

/**
 * The `stateAttributesMapping` entries that write each flag that holds as a bare `data-<flag>`
 * attribute from a `CalendarDayFlagState`. A part whose `useRender` state spreads the flag state,
 * such as the day button, passes these so every flag reaches the DOM under the same name.
 */
export const DAY_FLAG_STATE_ATTRIBUTES: Readonly<Record<keyof CalendarDayFlagState, BooleanStateAttribute>> =
  // SAFETY: as in dayFlagState, the six flags' fields are exactly CalendarDayFlagState's keys.
  Object.fromEntries(
    DAY_FLAGS.map((flag) => [
      DAY_FLAG_FIELDS[flag],
      (value: boolean) => (value ? { [`data-${flag}`]: "" } : null),
    ])
  ) as Record<keyof CalendarDayFlagState, BooleanStateAttribute>;

/**
 * The selection model a Root owns, and the one seam between the shared parts and how days are
 * selected. Calendar's owner holds one day; RangeCalendar's holds an anchor, a preview and a range.
 * The parts never read a selection themselves: they ask the owner for each day's flags and hand it
 * every selection input. A Root builds it with `createSelectionOwner`.
 *
 * - `useDayFlags` is a hook each day's gridcell calls once per render, which shares the flags
 *   with its button. `createSelectionOwner` subscribes it per day on the owner's own store, so a
 *   change re-renders only the days whose flags change, and the server and hydration read the
 *   store's initial state.
 * - `select` takes a press or Enter/Space on a day the user may select: inside the bounds, in its
 *   own month, not refused by `isDateUnavailable`, in a calendar neither disabled nor read-only.
 * - `hover` takes the pointer entering a day that is not disabled, for a preview that follows
 *   the pointer.
 *
 * A disabled day (out of bounds, in a neighbouring month, a disabled calendar) never reaches
 * `select` or `hover`, and the parts drop its flags.
 */
export type CalendarSelectionOwner = {
  /** The flags of one day, as a hook. Call it unconditionally, once per render. */
  readonly useDayFlags: (date: Temporal.PlainDate, iso: string) => CalendarDayFlags;
  /** Select a day the user pressed or chose with Enter or Space. */
  readonly select: (
    date: Temporal.PlainDate,
    reason: CalendarValueChangeReason,
    event: Event,
    trigger: Element
  ) => void;
  /** The pointer entered a day that is not disabled. */
  readonly hover: (date: Temporal.PlainDate, event: PointerEvent) => void;
};

/**
 * What a Root writes to make its selection owner: each day's flags as a pure answer about its
 * store's state, and the selection inputs.
 *
 * @template S - The Root's state.
 */
export type CalendarSelectionModel<S> = Omit<CalendarSelectionOwner, "useDayFlags"> & {
  /**
   * The flags of one day in a state. Pure, and cheap: it runs for every day on each store change.
   * It gets the day both as this runtime's PlainDate and as its ISO text, so it never parses one.
   */
  readonly dayFlags: (state: S, date: Temporal.PlainDate, iso: string) => CalendarDayFlags;
};

/**
 * A selection owner over a Root's store. Its `useDayFlags` subscribes each day to its own flags
 * through `useCalendarSelector`, so the store's initial state answers on the server and while a
 * part hydrates, for every Root alike.
 *
 * @template S - The Root's state.
 * @param store - The Root's store.
 * @param model - The day flags and the selection inputs.
 * @returns The owner the parts read.
 */
export function createSelectionOwner<S>(
  store: ReadableCalendarStore<S>,
  model: CalendarSelectionModel<S>
): CalendarSelectionOwner {
  return {
    useDayFlags(date, iso) {
      return useCalendarSelector(store, (state) => model.dayFlags(state, date, iso));
    },
    select: model.select,
    hover: model.hover,
  };
}

/** A Root's props, resolved for the shared parts. */
export type CalendarSettings = {
  /** The locale every name and format uses. */
  readonly locale: SupportedLocale;
  /** The first and last selectable days. */
  readonly bounds: DayBounds;
  /** Days the user may focus but not select. */
  readonly isDateUnavailable: ((date: Temporal.PlainDate) => boolean) | undefined;
  /** Whether nothing in the calendar responds. */
  readonly disabled: boolean;
  /** Whether the user may move around but not change the value. */
  readonly readOnly: boolean;
  /** The weekday each grid row starts on. */
  readonly firstDay: IsoWeekday;
  /** How many months show. */
  readonly visibleMonths: number;
  /** How the month buttons and keyboard page a multi-month view. */
  readonly pageBehavior: CalendarPageBehavior;
  /** The Root's own `aria-label`, which each grid's name starts with. */
  readonly ariaLabel: string | undefined;
  /** The Root's own `aria-labelledby`, which each grid's name starts with. */
  readonly ariaLabelledBy: string | undefined;
};

/** The navigation the shared parts ask a Root to do. Stable for the Root's lifetime. */
export type CalendarActions = {
  /** Keyboard focus landed on a day's button. */
  readonly focusDay: (date: Temporal.PlainDate) => void;
  /**
   * Focus left the day `left` for `next`, the blur's related target. Leaving the calendar's days
   * for anything else, a month button included, clears `gridFocused` and drops any pending focus
   * request. With no related target, the decision waits a frame for a remounted day to take focus.
   */
  readonly blurTo: (left: Element, next: Element | null) => void;
  /** Move focus by a key. */
  readonly move: (move: FocusMove, event: Event, trigger: Element) => void;
  /** Page the view with a month button. */
  readonly page: (step: 1 | -1, event: Event, trigger: Element) => void;
};

/** Everything a shared part reads from its Root. */
export type CalendarRootContextValue = {
  /** The Root's state. */
  readonly store: ReadableCalendarStore<CalendarSharedState>;
  /** The resolved props. */
  readonly settings: CalendarSettings;
  /** The navigation actions. */
  readonly actions: CalendarActions;
  /** The selection model: each day's flags and the selection inputs. Changes only with the settings. */
  readonly selection: CalendarSelectionOwner;
};

/** One visible month, from `Calendar.Month`. */
export type CalendarMonthContextValue = {
  /** The month the grid shows. */
  readonly month: Temporal.PlainYearMonth;
  /** The id of the `MonthHeading`'s name, which the grid points at. The `Month` owns it. */
  readonly headingId: string;
};

/** One day cell, from `Calendar.DayGridCell`, which works out the day's standing once for its button. */
export type CalendarDayContextValue = {
  /** The day. */
  readonly date: Temporal.PlainDate;
  /** The day as ISO text, the key every per-day answer reads. */
  readonly iso: string;
  /** Whether the day belongs to a neighbouring month, which the grid shows but never activates. */
  readonly outsideMonth: boolean;
  /** Whether the day cannot take focus: out of bounds, in a neighbouring month, or the calendar is disabled. */
  readonly disabled: boolean;
  /** Whether `isDateUnavailable` refuses the day: focusable, never selectable. */
  readonly unavailable: boolean;
  /** The selection owner's flags for the day, decoded once by the cell; none hold on a disabled day. */
  readonly flags: CalendarDayFlagState;
};

export const CalendarRootContext = createContext<CalendarRootContextValue | undefined>(undefined);
export const CalendarMonthContext = createContext<CalendarMonthContextValue | undefined>(undefined);
export const CalendarDayContext = createContext<CalendarDayContextValue | undefined>(undefined);

/**
 * The enclosing calendar Root.
 *
 * @param part - The part asking, named in the error.
 * @returns The Root's context.
 * @throws Error naming the part when it renders outside a calendar Root, a composition defect.
 */
export function useCalendarRootContext(part: string): CalendarRootContextValue {
  const value = use(CalendarRootContext);
  if (value === undefined) {
    throw new Error(`${part} must be rendered inside Calendar.Root or RangeCalendar.Root.`);
  }
  return value;
}

/**
 * The enclosing `Calendar.Month`.
 *
 * @param part - The part asking, named in the error.
 * @returns The month's context.
 * @throws Error naming the part when it renders outside `Calendar.Month`, a composition defect.
 */
export function useCalendarMonthContext(part: string): CalendarMonthContextValue {
  const value = use(CalendarMonthContext);
  if (value === undefined) {
    throw new Error(`${part} must be rendered inside Calendar.Month.`);
  }
  return value;
}

/**
 * The enclosing `Calendar.DayGridCell`.
 *
 * @param part - The part asking, named in the error.
 * @returns The cell's context.
 * @throws Error naming the part when it renders outside `Calendar.DayGridCell`, a composition defect.
 */
export function useCalendarDayContext(part: string): CalendarDayContextValue {
  const value = use(CalendarDayContext);
  if (value === undefined) {
    throw new Error(`${part} must be rendered inside Calendar.DayGridCell.`);
  }
  return value;
}
