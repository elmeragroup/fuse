"use client";

// RangeCalendar's selection, beside the navigation every calendar Root shares
// (`useCalendarNavigation`): each day's flags and name from the range shown, a day press or key
// that anchors or completes the range, the pointer preview, the commit a focus-out or an outside
// press makes, and the rule that a calendar turned read-only or disabled drops an open range. The
// rules themselves are `range-selection.ts`'s; this module wires them to the Root's store and
// callbacks.

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { createChangeEventDetails } from "../calendar/calendar-change-details";
import type { CalendarValueChangeReason } from "../calendar/calendar-change-details";
import type {
  CalendarSelectionModel,
  CalendarSettings,
  CalendarSharedState,
} from "../calendar/calendar-context";
import { useCalendarSelector } from "../calendar/calendar-store";
import type { CalendarStore } from "../calendar/calendar-store";
import type { CalendarShowDay } from "../calendar/use-calendar-navigation";
import { selectedRangeDescription } from "./range-calendar-format";
import type { RangeCalendarStrings } from "./range-calendar-format";
import {
  commitRange,
  namesRange,
  pressDay,
  rangeDayFlags,
  rangeValidationError,
  rangeView,
} from "./range-selection";
import type {
  DayRange,
  RangeCalendarRootValueChangeEventDetails,
  RangeCalendarValueChangeReason,
  RangeCommitBehavior,
  RangeRules,
  RangeView,
} from "./range-selection";

/** RangeCalendar's store state. */
export type RangeCalendarState = CalendarSharedState & {
  /** The selected range: the controlled value, mirrored, or the calendar's own. */
  readonly value: DayRange | null;
  /** The day a range being chosen starts from, or `null`. */
  readonly anchor: Temporal.PlainDate | null;
};

/** What the selection reads from the Root. */
export type RangeSelectionInput = {
  /** The Root's settings, narrowed around the anchor while one stands. */
  readonly settings: CalendarSettings;
  /** The Root's own rules, before an anchor narrows them. */
  readonly rules: RangeRules;
  /** The locale the range's description is written in. */
  readonly locale: string;
  /** RangeCalendar's strings in that locale. */
  readonly strings: RangeCalendarStrings;
  /** The id of the text that says what selecting the tab-stop day does. */
  readonly descriptionId: string;
  /** The navigation's `showDay`, which a keyboard anchor moves focus on with. */
  readonly showDay: CalendarShowDay;
  /** The Root's `onValueChange`, read when a range completes. */
  readonly onValueChange:
    | ((value: DayRange, details: RangeCalendarRootValueChangeEventDetails) => void)
    | undefined;
  /** Whether the parent owns the value. */
  readonly controlled: boolean;
  /** The Root's `commitBehavior`. */
  readonly commitBehavior: RangeCommitBehavior;
};

/** What the Root gets from `useRangeSelection`. */
export type RangeSelection = {
  /**
   * The selection model the Root makes its owner from with `createSelectionOwner`. Its identity
   * changes only with the settings, the rules, the locale and the description's id.
   */
  readonly model: CalendarSelectionModel<RangeCalendarState>;
  /** Completes or drops an open range by `commitBehavior`, on focus-out or an outside press. */
  readonly commit: (
    reason: "outside-press" | "focus-out",
    event: Event,
    trigger: Element | undefined
  ) => void;
  /** Whether the value, with no range open, fails the Root's rules. */
  readonly invalid: boolean;
};

/** The range view of each store state, and the description of each value, each kept for the last one asked. */
type RangeViews = {
  /** The view of a state. */
  readonly of: (state: RangeCalendarState) => RangeView;
  /** The description a value's ends are named with. */
  readonly describe: (value: DayRange) => string;
};

/** A one-entry cache of each answer, so the days of one state share one view and one description. */
function rangeViews(rules: RangeRules, locale: string, strings: RangeCalendarStrings): RangeViews {
  let last: { readonly state: RangeCalendarState; readonly view: RangeView } | undefined;
  let description: { readonly value: DayRange; readonly text: string } | undefined;
  return {
    of: (state) => {
      if (last?.state !== state) {
        last = { state, view: rangeView(state, rules) };
      }
      return last.view;
    },
    describe: (value) => {
      if (description?.value !== value) {
        description = { value, text: selectedRangeDescription(locale, strings, value) };
      }
      return description.text;
    },
  };
}

/**
 * Reports a completed range to the Root's `onValueChange`.
 *
 * @returns Whether the range stands, uncanceled.
 */
function reportRange(
  onValueChange: RangeSelectionInput["onValueChange"],
  rules: RangeRules,
  range: DayRange,
  reason: RangeCalendarValueChangeReason,
  event: Event,
  trigger: Element | undefined
): boolean {
  const details = createChangeEventDetails(reason, event, trigger, {
    getValidationError: () => rangeValidationError(range, rules),
  });
  onValueChange?.(range, details);
  return !details.isCanceled;
}

/** What the selection reads from the Root when an input runs, published after each render. */
type LatestInput = Pick<RangeSelectionInput, "rules" | "onValueChange" | "controlled" | "commitBehavior">;

/**
 * RangeCalendar's selection over its store.
 *
 * @param store - The Root's store.
 * @param input - What the selection reads from the Root, each field read when it is used.
 * @returns The selection model, the commit and whether the value is invalid.
 */
export function useRangeSelection(
  store: CalendarStore<RangeCalendarState>,
  input: RangeSelectionInput
): RangeSelection {
  const {
    settings,
    rules,
    locale,
    strings,
    descriptionId,
    showDay,
    onValueChange,
    controlled,
    commitBehavior,
  } = input;
  // What the selection inputs read when they run, published after each render.
  const latest = useRef<LatestInput>({ rules, onValueChange, controlled, commitBehavior });
  useLayoutEffect(() => {
    latest.current = { rules, onValueChange, controlled, commitBehavior };
  });

  // A calendar made read-only or disabled while a range is open drops the range, in the same
  // layout pass that publishes the new settings: nothing it could complete would be accepted, and
  // no event runs between the two, so a commit never meets an open range in such a calendar.
  const { disabled, readOnly } = settings;
  useLayoutEffect(() => {
    const state = store.get();
    if ((disabled || readOnly) && state.anchor !== null) {
      store.set({ ...state, anchor: null });
    }
  }, [store, disabled, readOnly]);

  // One view per store state, which every day's flags and name and the Root's invalid selector
  // read, and the description of the value it names the range's ends with, written once per value.
  const views = useMemo(() => rangeViews(rules, locale, strings), [rules, locale, strings]);

  // A day pressed or chosen with Enter or Space: it anchors a range, or completes the open one. A
  // press anchors on the day pressed. A key anchors, then moves focus on by a day under the
  // anchored bounds, paging if needed; a canceled page leaves focus on the anchor.
  const select = useCallback(
    (date: Temporal.PlainDate, reason: CalendarValueChangeReason, event: Event, trigger: Element) => {
      const { rules: current, onValueChange: report, controlled: isControlled } = latest.current;
      const state = store.get();
      const press = pressDay(state.anchor, date, current, reason === "keyboard");
      if (press.kind === "anchored") {
        if (reason !== "keyboard") {
          store.set({ ...state, anchor: press.anchor, focused: press.focus });
          return;
        }
        store.set({ ...state, anchor: press.anchor, focused: press.anchor, focusRequest: true });
        showDay(press.focus, press.bounds, event, trigger);
        return;
      }
      if (!reportRange(report, current, press.range, reason, event, trigger)) {
        store.set({ ...store.get(), focused: date });
        return;
      }
      const after = store.get();
      store.set({ ...after, anchor: null, focused: date, value: isControlled ? after.value : press.range });
    },
    [store, showDay]
  );

  const commit = useCallback(
    (reason: "outside-press" | "focus-out", event: Event, trigger: Element | undefined) => {
      const {
        rules: current,
        onValueChange: report,
        commitBehavior: behavior,
        controlled: isControlled,
      } = latest.current;
      const state = store.get();
      if (state.anchor === null || state.focused === null || state.visible === null) {
        return;
      }
      // The focused day walks back past unavailable days no further than the first visible day.
      const from = state.visible.start.toPlainDate({ day: 1 });
      const range = commitRange(state.anchor, state.focused, current, from, behavior);
      const stands = range !== null && reportRange(report, current, range, reason, event, trigger);
      const after = store.get();
      store.set({ ...after, anchor: null, value: stands && !isControlled ? range : after.value });
    },
    [store]
  );

  // Every per-day answer reads the state its selector is handed, so the server and a hydrating day
  // answer from the store's initial state (D-2-12).
  const model = useMemo(
    (): CalendarSelectionModel<RangeCalendarState> => ({
      dayFlags: (state, date) => rangeDayFlags(views.of(state), date, settings.isDateUnavailable),
      dayNamePrefix: (state, date) =>
        state.value !== null && namesRange(views.of(state), date) ? views.describe(state.value) : "",
      dayDescriptionId: descriptionId,
      multiselectable: true,
      select,
      hover(date, event) {
        const state = store.get();
        // Touch has no hover; a pointer leaving the grids keeps the range where it last was, as in
        // React Aria.
        if (
          event.pointerType === "touch" ||
          state.anchor === null ||
          settings.isDateUnavailable?.(date) === true ||
          state.focused?.equals(date) === true
        ) {
          return;
        }
        // The highlight follows the pointer as React Aria's `highlightDate` does: the tab stop
        // moves there, DOM focus stays where it is.
        store.set({ ...state, focused: date, focusRequest: false });
      },
    }),
    [store, settings, views, descriptionId, select]
  );

  const invalid = useCalendarSelector(store, (state) => views.of(state).invalid);
  return { model, commit, invalid };
}
