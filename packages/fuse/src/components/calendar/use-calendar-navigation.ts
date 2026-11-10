"use client";

// The part of a calendar Root that every selection model shares: today from the clock, the view
// kept in step with `visibleMonths` and the bounds, and moving focus and the view by keyboard and
// month button. A Root adds only how a day is selected.

import { useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";

import { deepActiveElement } from "../../internal/active-element";
import { containsAcrossShadowRoots } from "../../internal/dom-node";
import { temporal } from "../../temporal/temporal";
import { today as readToday } from "../../temporal/today";
import { createChangeEventDetails } from "./calendar-change-details";
import type { CalendarChangeEventDetails } from "./calendar-change-details";
import type { CalendarActions, CalendarSettings, CalendarSharedState } from "./calendar-context";
import { canPage, clampDay, monthsShowing, movedDay, openView, pageTarget, showsDay } from "./calendar-dates";
import type { DayBounds } from "./calendar-dates";
import type { CalendarStore } from "./calendar-store";

/** The gestures that change the visible months. */
export type CalendarVisibleRangeChangeReason = "increment-press" | "decrement-press" | "keyboard";

/** What `onVisibleRangeChange` receives beside the new first month. */
export type CalendarVisibleRangeChangeEventDetails =
  CalendarChangeEventDetails<CalendarVisibleRangeChangeReason>;

/**
 * Reports a change of the visible months. Canceling it keeps the months shown: a month button
 * press does nothing, and a key that would page leaves focus on the day it was on.
 */
export type CalendarVisibleRangeChangeHandler = (
  start: Temporal.PlainYearMonth,
  details: CalendarVisibleRangeChangeEventDetails
) => void;

/**
 * The shared state a Root starts from, before the clock is read: focus on the clamped day it is
 * given and the view centred on it, or nothing to show yet when it has no day.
 *
 * @param focused - The value or default value's day, or `null` when the Root starts empty.
 * @param settings - The Root's bounds and month count.
 * @returns The state.
 */
export function initialSharedState(
  focused: Temporal.PlainDate | null,
  settings: Pick<CalendarSettings, "bounds" | "visibleMonths">
): CalendarSharedState {
  const view =
    focused === null
      ? { focused: null, visible: null }
      : openView(focused, settings.visibleMonths, settings.bounds);
  return { ...view, today: null, focusRequest: false, gridFocused: false, paged: false };
}

/**
 * The element focus is on in a document, or its body when nothing is: what a blur with no
 * related target leaves focused, and what a disabled day's lost focus falls back to.
 */
function focusedElement(ownerDocument: Document): Element {
  return deepActiveElement(ownerDocument) ?? ownerDocument.body;
}

/**
 * Whether focus on `active` still counts as the calendar's: inside the Root, or dropped to the
 * body, as a day disabled under focus drops it.
 */
function stillHeld(root: HTMLElement, active: Element): boolean {
  return active === root.ownerDocument.body || containsAcrossShadowRoots(root, active);
}

/** The milliseconds from now until `day` ends in `timeZone`. */
function untilDayEnds(day: Temporal.PlainDate, timeZone: string): number {
  return day.add({ days: 1 }).toZonedDateTime(timeZone).epochMilliseconds - Date.now();
}

/**
 * Shows a day under the given bounds and moves the tab stop and DOM focus to it, paging the view
 * when the day is outside the visible months. A page is reported through `onVisibleRangeChange`
 * with the reason `"keyboard"`; canceling it leaves the state as it was.
 *
 * @param date - The day, inside `bounds`.
 * @param bounds - The bounds the page keeps the view inside, which may be narrower than the
 *   Root's, such as a range's while it is being chosen.
 * @param event - The DOM event behind the move.
 * @param trigger - The element the gesture happened on.
 * @returns `false` when the page was canceled or the calendar shows no months yet.
 */
export type CalendarShowDay = (
  date: Temporal.PlainDate,
  bounds: DayBounds,
  event: Event,
  trigger: Element
) => boolean;

/** The navigation a Root gets from `useCalendarNavigation`. */
export type CalendarNavigation = {
  /** The actions the shared parts call, which the Root puts on their context. */
  readonly actions: CalendarActions;
  /** Show a day, paging if needed: the transition behind every keyboard move, for the Root's own use. */
  readonly showDay: CalendarShowDay;
};

/**
 * The navigation every calendar Root shares.
 *
 * Today is read in a layout effect, never while rendering, so a server render shows no today and
 * stays the same as the first client render; a calendar with neither a value nor a default value
 * shows its months from that effect on. It re-reads at the next midnight in `timeZone` and when
 * the page becomes visible again, so a calendar left open overnight moves its today marking.
 *
 * @template S - The Root's state.
 * @param store - The Root's store.
 * @param settings - The Root's resolved props.
 * @param timeZone - The zone today is read in.
 * @param onVisibleRangeChange - The Root's `onVisibleRangeChange`, read when called.
 * @param rootRef - The Root's element, which tells a move between days from a move out of them.
 * @returns The parts' actions and `showDay`; both are stable for the Root's lifetime.
 */
export function useCalendarNavigation<S extends CalendarSharedState>(
  store: CalendarStore<S>,
  settings: CalendarSettings,
  timeZone: string | undefined,
  onVisibleRangeChange: CalendarVisibleRangeChangeHandler | undefined,
  rootRef: RefObject<HTMLElement | null>
): CalendarNavigation {
  const latest = useRef({ settings, onVisibleRangeChange });
  useLayoutEffect(() => {
    latest.current = { settings, onVisibleRangeChange };
  });

  // The bounds and month count are read when the clock is, through `latest` (assigned by the
  // effect above, which runs first), since only a view not yet opened needs them: a change to
  // either is the re-align effect's to handle, and keeps the timer and the listener.
  useLayoutEffect(() => {
    const zone = timeZone ?? temporal().Now.timeZoneId();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const now = readToday(zone);
      const state = store.get();
      let next = state.today?.equals(now) === true ? state : { ...state, today: now };
      if (next.visible === null) {
        const { bounds, visibleMonths } = latest.current.settings;
        next = { ...next, ...openView(now, visibleMonths, bounds) };
      }
      store.set(next);
      clearTimeout(timer);
      timer = setTimeout(refresh, Math.max(0, untilDayEnds(now, zone)));
    };
    // The Root's own document, so a calendar rendered into a frame follows that frame's tab
    // (Base UI #4412).
    const ownerDocument = rootRef.current?.ownerDocument ?? document;
    const onVisibilityChange = () => {
      if (ownerDocument.visibilityState === "visible") {
        refresh();
      }
    };
    refresh();
    ownerDocument.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimeout(timer);
      ownerDocument.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [store, timeZone, rootRef]);

  // A new month count or new bounds re-align the view around the focused day, as React Aria does
  // when `visibleDuration` changes. The first run finds nothing to change. When the clamp moves
  // the focused day while a day held keyboard focus, the old day may just have been disabled,
  // which drops DOM focus to the body: focus follows to the clamped day. Focus the user moved
  // elsewhere stays there, and so does a request left from before focus moved away.
  const { bounds, visibleMonths } = settings;
  useLayoutEffect(() => {
    const state = store.get();
    if (state.focused === null || state.visible === null) {
      return;
    }
    const opened = openView(state.focused, visibleMonths, bounds);
    const { focused } = opened;
    const visible =
      state.visible.count === visibleMonths && showsDay(state.visible, focused)
        ? state.visible
        : opened.visible;
    const moved = !focused.equals(state.focused);
    if (visible === state.visible && !moved) {
      return;
    }
    const root = rootRef.current;
    const heldFocus =
      state.gridFocused && (root === null || stillHeld(root, focusedElement(root.ownerDocument)));
    store.set({ ...state, focused, visible, focusRequest: heldFocus && (state.focusRequest || moved) });
  }, [store, bounds, visibleMonths, rootRef]);

  return useMemo((): CalendarNavigation => {
    /** Calls `onVisibleRangeChange`, reporting whether the change stands. */
    const reportVisible = (
      start: Temporal.PlainYearMonth,
      reason: CalendarVisibleRangeChangeReason,
      event: Event,
      trigger: Element
    ): boolean => {
      const details = createChangeEventDetails(reason, event, trigger, {});
      latest.current.onVisibleRangeChange?.(start, details);
      return !details.isCanceled;
    };
    const showDay: CalendarShowDay = (date, dayBounds, event, trigger) => {
      const state = store.get();
      if (state.visible === null) {
        return false;
      }
      const visible = monthsShowing(state.visible, date, latest.current.settings.pageBehavior, dayBounds);
      const pages = visible !== state.visible;
      if (pages && !reportVisible(visible.start, "keyboard", event, trigger)) {
        return false;
      }
      store.set({ ...state, focused: date, visible, focusRequest: true, paged: state.paged || pages });
      return true;
    };
    const actions: CalendarActions = {
      focusDay(date) {
        const state = store.get();
        if (state.focused?.equals(date) === true && state.gridFocused) {
          return;
        }
        store.set({ ...state, focused: date, gridFocused: true });
      },
      blurTo(left, next) {
        const leaveFor = (target: Element) => {
          const root = rootRef.current;
          if (
            root !== null &&
            containsAcrossShadowRoots(root, target) &&
            target.closest("[data-slot=calendar-day-button]") !== null
          ) {
            return;
          }
          const state = store.get();
          if (state.gridFocused || state.focusRequest) {
            store.set({ ...state, gridFocused: false, focusRequest: false });
          }
        };
        if (next !== null) {
          leaveFor(next);
          return;
        }
        // A blur with no related target is a click on blank space, the window losing focus, or the
        // focused day removed by a month remount, whose replacement takes focus in a layout effect.
        // On the next frame, focus that went to nothing with the day still in the page and its
        // window still focused has left the calendar.
        const { ownerDocument } = left;
        ownerDocument.defaultView?.requestAnimationFrame(() => {
          if (left.isConnected && ownerDocument.hasFocus()) {
            leaveFor(focusedElement(ownerDocument));
          }
        });
      },
      move(move, event, trigger) {
        const { settings: current } = latest.current;
        const state = store.get();
        if (current.disabled || state.focused === null) {
          return;
        }
        showDay(clampDay(movedDay(state.focused, move), current.bounds), current.bounds, event, trigger);
      },
      page(step, event, trigger) {
        const { settings: current } = latest.current;
        const state = store.get();
        if (
          current.disabled ||
          state.focused === null ||
          state.visible === null ||
          !canPage(state.visible, step, current.bounds)
        ) {
          return;
        }
        const size = current.pageBehavior === "visible" ? current.visibleMonths : 1;
        const target = pageTarget(state.visible, state.focused, step, size, current.bounds);
        const reason = step === 1 ? "increment-press" : "decrement-press";
        if (!reportVisible(target.visible.start, reason, event, trigger)) {
          return;
        }
        store.set({
          ...state,
          visible: target.visible,
          focused: target.focused,
          focusRequest: false,
          paged: true,
        });
      },
    };
    return { actions, showDay };
  }, [store, rootRef]);
}
