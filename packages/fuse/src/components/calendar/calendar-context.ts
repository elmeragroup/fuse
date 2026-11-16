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
  /** The day the grid's single tab stop is on, always inside `visible`. It is `null` while `visible` is. */
  readonly focused: Temporal.PlainDate | null;
  /** Today in the Root's time zone, or `null` before the first effect, as on the server. */
  readonly today: Temporal.PlainDate | null;
  /**
   * Whether DOM focus follows `focused`. A keyboard move sets it, so the focused day's button takes
   * focus once it renders, also after its month remounts. A month button press and focus leaving
   * the calendar clear it.
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
 * The one day-flag table, which maps each `CalendarDayFlagState` field to its flag. The `satisfies`
 * check limits its keys to exactly the state's fields, so neither a field without a flag nor a flag
 * without a field compiles. The `CalendarDayFlag` union derives from it, and its key order is the
 * order `dayFlags` writes.
 */
const DAY_FLAG_NAMES = {
  selected: "selected",
  selectionStart: "selection-start",
  selectionEnd: "selection-end",
  inRange: "in-range",
  highlighted: "highlighted",
  invalid: "invalid",
} as const satisfies Record<keyof CalendarDayFlagState, string>;

/** Every day flag, in the table's key order. */
const DAY_FLAGS = Object.values(DAY_FLAG_NAMES);

/**
 * One fact about a day's place in the selection. The day button writes each flag that holds as a
 * bare `data-<flag>` attribute and shares it with its `render` callback as a boolean, and the
 * gridcell is `aria-selected` when `selected` holds:
 *
 * - `selected`: the day is part of the value; the gridcell is `aria-selected`.
 * - `selection-start` / `selection-end`: the first or last day of a range value or preview.
 * - `in-range`: a day between a range's ends, including the ends.
 * - `highlighted`: a day inside a range the user is choosing, as the pointer or focus previews it.
 * - `invalid`: the selection fails validation on this day; the button is `aria-invalid`.
 *
 * Calendar reports only `selected` and `invalid`; RangeCalendar reports the rest.
 */
export type CalendarDayFlag = (typeof DAY_FLAG_NAMES)[keyof typeof DAY_FLAG_NAMES];

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
 * @param flags - The flags that hold, in any order, with repeats allowed.
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
  /** Whether the day lies between a range's ends, including the ends. */
  readonly inRange: boolean;
  /** Whether the day lies inside a range the user is choosing. */
  readonly highlighted: boolean;
  /** Whether the selection fails validation on this day. */
  readonly invalid: boolean;
};

/**
 * One value for each `CalendarDayFlagState` field.
 *
 * @template T - The value each field holds.
 */
type DayFlagFields<T> = { readonly [Field in keyof CalendarDayFlagState]: T };

/**
 * One value for each render-state field, from the field's flag. TypeScript checks the literal
 * against `CalendarDayFlagState`'s fields, so it names every field and no other.
 *
 * @template T - The value each field holds.
 * @param map - The value for one flag.
 * @returns One value for each field.
 */
function byDayFlagField<T>(map: (flag: CalendarDayFlag) => T): DayFlagFields<T> {
  return {
    selected: map(DAY_FLAG_NAMES.selected),
    selectionStart: map(DAY_FLAG_NAMES.selectionStart),
    selectionEnd: map(DAY_FLAG_NAMES.selectionEnd),
    inRange: map(DAY_FLAG_NAMES.inRange),
    highlighted: map(DAY_FLAG_NAMES.highlighted),
    invalid: map(DAY_FLAG_NAMES.invalid),
  };
}

/**
 * A day's flags as the booleans of its render state: `selected`, `selectionStart`,
 * `selectionEnd`, `inRange`, `highlighted` and `invalid`. It is the only decoder of
 * `CalendarDayFlags`, and the gridcell calls it once per day and shares the result with its button.
 *
 * @param flags - The day's flags.
 * @returns One boolean for each flag.
 */
export function dayFlagState(flags: CalendarDayFlags): CalendarDayFlagState {
  const present = new Set(flags.split(" "));
  return byDayFlagField((flag) => present.has(flag));
}

/** A render-state attribute writer, in the shape of Base UI's `stateAttributesMapping`. */
type BooleanStateAttribute = (value: boolean) => Record<string, string> | null;

/**
 * The `stateAttributesMapping` entries that write each flag that holds as a bare `data-<flag>`
 * attribute from a `CalendarDayFlagState`. A part whose `useRender` state spreads the flag state,
 * such as the day button, passes these so every flag reaches the DOM under the same name.
 */
export const DAY_FLAG_STATE_ATTRIBUTES: DayFlagFields<BooleanStateAttribute> = byDayFlagField(
  (flag) => (value: boolean) => (value ? { [`data-${flag}`]: "" } : null)
);

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
 * - `select` takes a press or Enter or Space on a day the user may select: inside the bounds, in its
 *   own month, not refused by `isDateUnavailable`, in a calendar neither disabled nor read-only.
 * - `hover` takes the pointer entering a day that is not disabled, for a preview that follows
 *   the pointer.
 * - `cancel` handles Escape on a day. It returns whether it dropped something. The day button stops
 *   the key only then, so an enclosing popup closes on an Escape that drops nothing.
 *
 * A disabled day, one out of bounds, in a neighboring month or in a disabled calendar, never
 * reaches `select` or `hover`, and the parts drop its flags.
 */
export type CalendarSelectionOwner = {
  /** The flags of one day, as a hook. Call it unconditionally, once per render. */
  readonly useDayFlags: (date: Temporal.PlainDate, iso: string) => CalendarDayFlags;
  /** Selects a day the user pressed or chose with Enter or Space. */
  readonly select: (
    date: Temporal.PlainDate,
    reason: CalendarValueChangeReason,
    event: Event,
    trigger: Element
  ) => void;
  /** Called when the pointer enters a day that is not disabled. */
  readonly hover: (date: Temporal.PlainDate, event: PointerEvent) => void;
  /**
   * Drops what is being chosen, for Escape on a day. It returns `true` when it drops something, and
   * `false` when nothing is being chosen. RangeCalendar drops an open range's anchor; Calendar has
   * nothing to drop.
   */
  readonly cancel: () => boolean;
  /**
   * The words a day's name starts with, or `""`, as a hook each day button calls once per render like
   * `useDayFlags`. RangeCalendar names its range's ends with the whole range ("Selected Range:
   * …"); Calendar's is always `""`.
   */
  readonly useDayNamePrefix: (date: Temporal.PlainDate, iso: string) => string;
  /**
   * The id of the text that says what selecting the tab-stop day does, which that day's button
   * points `aria-describedby` at while it is selectable. RangeCalendar's says whether a press
   * starts or finishes a range. Calendar has none, so its id is `undefined`.
   */
  readonly dayDescriptionId: string | undefined;
  /**
   * Whether the selection holds several days at once, which makes every grid
   * `aria-multiselectable`: RangeCalendar's range does, Calendar's one day does not.
   */
  readonly multiselectable: boolean;
};

/**
 * What a Root writes to make its selection owner: each day's flags as a pure answer about its
 * store's state, and the selection inputs.
 *
 * @template S - The Root's state.
 */
export type CalendarSelectionModel<S> = Omit<CalendarSelectionOwner, "useDayFlags" | "useDayNamePrefix"> & {
  /**
   * The flags of one day in a state. It is pure and cheap, because it runs for every day on each
   * store change.
   * It gets the day both as this runtime's PlainDate and as its ISO text, so it never parses one.
   */
  readonly dayFlags: (state: S, date: Temporal.PlainDate, iso: string) => CalendarDayFlags;
  /** The words one day's name starts with in a state, or `""`. It is pure and cheap, like `dayFlags`. */
  readonly dayNamePrefix: (state: S, date: Temporal.PlainDate, iso: string) => string;
};

/**
 * A selection owner over a Root's store. Its `useDayFlags` and `useDayNamePrefix` subscribe each
 * day to its own answer through `useCalendarSelector`, so the store's initial state answers on the
 * server and while a part hydrates, for every Root alike.
 *
 * @template S - The Root's state.
 * @param store - The Root's store.
 * @param model - The per-day answers and the selection inputs.
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
    useDayNamePrefix(date, iso) {
      return useCalendarSelector(store, (state) => model.dayNamePrefix(state, date, iso));
    },
    dayDescriptionId: model.dayDescriptionId,
    multiselectable: model.multiselectable,
    select: model.select,
    hover: model.hover,
    cancel: model.cancel,
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
  /** The number of months the calendar shows. */
  readonly visibleMonths: number;
  /** How the month buttons and keyboard page a multi-month view. */
  readonly pageBehavior: CalendarPageBehavior;
  /** The Root's own `aria-label`, which each grid's name starts with. */
  readonly ariaLabel: string | undefined;
  /** The Root's own `aria-labelledby`, which each grid's name starts with. */
  readonly ariaLabelledBy: string | undefined;
};

/** The navigation the shared parts ask a Root to do. It stays stable for the Root's lifetime. */
export type CalendarActions = {
  /** Called when keyboard focus lands on a day's button. */
  readonly focusDay: (date: Temporal.PlainDate) => void;
  /**
   * Called when focus leaves the day `left` for `next`, the blur's related target. Leaving the
   * calendar's days for anything else, including a month button, clears `gridFocused` and drops any
   * pending focus request. With no related target, the decision waits a frame for a remounted day
   * to take focus.
   */
  readonly blurTo: (left: Element, next: Element | null) => void;
  /** Registers a mounted day's button, which `blurTo` uses to recognize a move between days. */
  readonly registerDay: CalendarDayRegistration;
  /** Moves focus by a key. */
  readonly move: (move: FocusMove, event: Event, trigger: Element) => void;
  /** Pages the view with a month button. */
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
  /** The id of the `Calendar.MonthHeading`'s name, which the grid points at. `Calendar.Month` creates it. */
  readonly headingId: string;
};

/** One day cell, from `Calendar.DayGridCell`, which works out the day's standing once for its button. */
export type CalendarDayContextValue = {
  /** The day. */
  readonly date: Temporal.PlainDate;
  /** The day as ISO text, the key every per-day answer reads. */
  readonly iso: string;
  /** Whether the day belongs to a neighboring month, which the grid shows but never activates. */
  readonly outsideMonth: boolean;
  /**
   * Whether the day cannot take focus: out of bounds, in a neighboring month, or the calendar is
   * disabled.
   */
  readonly disabled: boolean;
  /** Whether `isDateUnavailable` refuses the day, which the user may focus but never select. */
  readonly unavailable: boolean;
  /** The selection owner's flags for the day, decoded once by the cell; none hold on a disabled day. */
  readonly flags: CalendarDayFlagState;
};

export const CalendarRootContext = createContext<CalendarRootContextValue | undefined>(undefined);
export const CalendarMonthContext = createContext<CalendarMonthContextValue | undefined>(undefined);
export const CalendarDayContext = createContext<CalendarDayContextValue | undefined>(undefined);

/** Registers a mounted day's button and returns its unregistration. */
export type CalendarDayRegistration = (button: HTMLButtonElement) => () => void;

/**
 * A container around one or more calendars that moves focus into them, such as a picker's popup.
 * Every day button of every calendar inside it registers with it.
 */
export const CalendarDayRegistryContext = createContext<CalendarDayRegistration | undefined>(undefined);

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
