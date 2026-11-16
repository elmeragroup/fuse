"use client";

// This module is a calendar Root's private interface for the date pickers. A picker controls the
// value its calendar shows and changes it from outside the calendar, through typing, a preset, the
// parent or a form reset. A standalone controlled calendar keeps its view when its value changes, as
// React Aria's does. A picker's calendar moves its view to that value instead, in place, so a
// calendar that has focus keeps it. The pickers provide `CalendarViewFollowContext`, and the
// package does not export it.

import { createContext, use, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

import { useStableCallback } from "../../hooks/use-stable-callback";
import type { CalendarSharedState } from "./calendar-context";
import { showsDay } from "./calendar-dates";
import type { OpenedView } from "./calendar-dates";
import type { CalendarStore } from "./calendar-store";
import { holdsDayFocus } from "./use-calendar-navigation";

/**
 * What a picker's calendar view follows. The counts, not the value, signal a change, so only a
 * change that the picker counts in `useOutsideChanges` moves the view.
 */
export type CalendarViewFollow = {
  /**
   * The picker's form-reset count. A new count starts the view over on the value, even when the
   * value is unchanged.
   */
  readonly resets: number;
  /** The count of the picker's value changes that came from outside it; see `useOutsideChanges`. */
  readonly changes: number;
};

/** What the picker over a calendar has its view follow, or `null` for a standalone calendar. */
export const CalendarViewFollowContext = createContext<CalendarViewFollow | null>(null);

/** Where a Root's value puts its view. */
export type ValuePlacement<S> = {
  /**
   * The days that stand for the value: its day, or a range's two ends, or today without a value.
   * A view that shows any of them stays where it is.
   */
  readonly days: readonly Temporal.PlainDate[];
  /** The state with the view left where it is and any selection in progress dropped. */
  readonly kept: S;
  /** The view opened on the value, as the Root opens on mount, which replaces `kept`'s. */
  readonly view: OpenedView;
};

/**
 * Moves a picker's calendar view to its value on each outside change. A value the view does not
 * show opens the view on it. A value the view shows leaves the months and the focused day alone.
 * Either way, the change drops a selection in progress, such as a range's anchor, which the new
 * value replaces. A form reset opens the view on the value whatever the view shows. When a day has
 * keyboard focus, focus follows to the newly focused day, so it stays inside the calendar, where a
 * remount would drop it to the body. Without `CalendarViewFollowContext` the hook does nothing.
 *
 * Call it after the Root's controlled-value effect, so the store holds the new value. Call it after
 * `useCalendarNavigation` too, so that hook's re-align reads bounds made for the selection the store
 * still holds, before this hook drops it.
 *
 * @template S - The Root's state.
 * @param store - The Root's store.
 * @param place - Where the state's value puts the view, or `null` when there is nothing to open on
 *   yet, with no value and today not read. The hook calls it when a change comes.
 * @param rootRef - The Root's element, which tells whether focus is still the calendar's.
 */
export function useViewFollowsValue<S extends CalendarSharedState>(
  store: CalendarStore<S>,
  place: (state: S) => ValuePlacement<S> | null,
  rootRef: RefObject<HTMLElement | null>
): void {
  const follow = use(CalendarViewFollowContext);
  const resets = follow?.resets;
  const changes = follow?.changes;
  const latestPlace = useStableCallback(place);
  const handled = useRef({ resets, changes });
  useLayoutEffect(() => {
    const before = handled.current;
    handled.current = { resets, changes };
    if (resets === undefined || (before.resets === resets && before.changes === changes)) {
      return;
    }
    const state = store.get();
    const { visible } = state;
    // A view not yet opened opens on the value, or on today when the clock is read.
    if (visible === null) {
      return;
    }
    const placement = latestPlace(state);
    if (placement === null) {
      return;
    }
    if (before.resets === resets && placement.days.some((day) => showsDay(visible, day))) {
      store.set(placement.kept);
      return;
    }
    store.set({ ...placement.kept, ...placement.view, focusRequest: holdsDayFocus(state, rootRef.current) });
  }, [store, resets, changes, latestPlace, rootRef]);
}
