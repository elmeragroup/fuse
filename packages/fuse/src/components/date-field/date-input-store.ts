"use client";

// This module runs the edit session in React. One Calendar store, from `calendar-store.ts`, stores
// the session state, and every gesture applies a pure transition of it from `date-input-session.ts`.
// `run` carries out the commit protocol. A transition that commits reports its value through
// `onValueChange` first. A `cancel()` in that callback discards the edit, and `canceled` shows the
// unchanged value again. Otherwise the transition's state applies and focus moves where the
// transition says.
//
// The input creates the store before the Field integration, because the integration reads the
// committed value and the entry's error. The session hook is therefore two calls. The input calls
// `useSessionStore` early and `useSessionActions` once it knows the Field and the settings. At event
// time, gestures read the settings, rules and callback of the last committed render from a ref that
// a layout effect updates. A handler never closes over a stale render, and nothing calls one while
// rendering.

import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ClipboardEvent, FocusEvent, KeyboardEvent, RefObject } from "react";

import { useFormReset } from "../../hooks/use-form-reset";
import { isElement, isNode } from "../../internal/dom-node";
import type { TemporalValue } from "../../temporal/temporal-value";
import { createChangeEventDetails } from "../calendar/calendar-change-details";
import { createCalendarStore } from "../calendar/calendar-store";
import type { CalendarStore } from "../calendar/calendar-store";
import type { EditableSegmentType } from "./date-draft";
import type { DateInputBoundary } from "./date-input-boundary";
import type { DateInputValueChangeEventDetails } from "./date-input-change-details";
import type { DateInputActions } from "./date-input-context";
import type { DateInputField } from "./date-input-field";
import { focusAroundRemoved, focusSibling } from "./date-input-focus";
import type { DateInputNeighbor } from "./date-input-neighbors";
import {
  canceled,
  confirm,
  erase,
  focusEntered,
  initialSession,
  paste,
  rebase,
  resetSession,
  segmentFocused,
  step,
  toEdge,
  typeKey,
} from "./date-input-session";
import type { SessionSettings, SessionState, SessionTransition } from "./date-input-session";
import type { DateInputValue } from "./date-input-types";
import { valueError } from "./date-input-validation";
import type { DateInputRules } from "./date-input-validation";

/** React Aria's page steps: Page Up and Page Down move a segment this far. */
const PAGE_STEP = {
  year: 5,
  month: 2,
  day: 7,
  hour: 2,
  minute: 15,
  second: 15,
  dayPeriod: 1,
} as const satisfies Record<EditableSegmentType, number>;

/** The transition a key makes on a segment, or `undefined` for a key the segment leaves alone. */
function keyTransition(
  key: string,
  type: EditableSegmentType,
  settings: SessionSettings,
  state: SessionState
): SessionTransition | undefined {
  const page = PAGE_STEP[type];
  switch (key) {
    case "ArrowUp":
      return step(state, type, 1, settings);
    case "ArrowDown":
      return step(state, type, -1, settings);
    case "PageUp":
      return step(state, type, page, settings);
    case "PageDown":
      return step(state, type, -page, settings);
    case "Home":
      return toEdge(state, type, "min", settings);
    case "End":
      return toEdge(state, type, "max", settings);
    default:
      return undefined;
  }
}

/** The session's store and the state it holds this render. */
export type SessionStore = {
  readonly store: CalendarStore<SessionState>;
  readonly session: SessionState;
};

/**
 * The edit session's one store. The segments are not known yet, so the first session holds no
 * draft and no basis. The rebase in `useSessionActions` sets the basis before any gesture reads it.
 *
 * @param initialOwn - The input's own first value, its parsed `defaultValue`.
 * @returns The store and its state this render.
 */
export function useSessionStore(initialOwn: TemporalValue | null): SessionStore {
  const [store] = useState(() => createCalendarStore(initialSession(initialOwn, "")));
  const session = useSyncExternalStore(store.subscribe, store.get, () => store.initial);
  return { store, session };
}

/** Options for `useSessionActions`, the values the session's gestures read. */
export type SessionActionsOptions<T extends DateInputValue> = {
  /** The key of the committed value and the shown segments, from `basisOf`, which a draft belongs to. */
  readonly basis: string;
  /** The settings a transition reads this render. */
  readonly settings: SessionSettings;
  /** What a committed value is checked against, for its change details. */
  readonly rules: DateInputRules;
  /** Called when the input proposes a value change; the input's `onValueChange`. */
  readonly onValueChange: ((value: T | null, details: DateInputValueChangeEventDetails) => void) | undefined;
  /** Returns the surrounding control's adjacent input, for focus past the first or last segment. */
  readonly neighbor: DateInputNeighbor | undefined;
  /** The surrounding control's widened focus boundary, if any; see `date-input-boundary.ts`. */
  readonly boundary: DateInputBoundary | undefined;
  /** The Root element. */
  readonly rootRef: RefObject<HTMLElement | null>;
  /** The input's own value a native form reset restores. */
  readonly defaultValue: TemporalValue | null;
  /**
   * The Field integration, which the session tells of focus, blur, a dropped draft and a reset. A
   * native form reset finds the input by the integration's hidden input.
   */
  readonly field: Pick<DateInputField, "setFocused" | "blurred" | "revalidate" | "reset" | "hiddenInput">;
};

/** The Root element's focus, blur and paste handlers. */
type SessionRootHandlers = {
  readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLElement>) => void;
};

/** The session's gestures. */
export type SessionActions = {
  /** What segments do, through the Root's context. */
  readonly actions: DateInputActions;
  /** What the Root element does. */
  readonly rootHandlers: SessionRootHandlers;
};

/** Whether focus moves between the group's own segments rather than entering or leaving it. */
function staysInside(event: FocusEvent<HTMLElement>): boolean {
  return isNode(event.relatedTarget) && event.currentTarget.contains(event.relatedTarget);
}

/**
 * The session's gestures over its store, the rebase that keeps a draft on its basis, and the
 * native form reset of an input that owns its value.
 *
 * @template T - The input's value kind.
 * @param store - The session's store, from `useSessionStore`.
 * @param options - What the gestures read this render.
 * @returns The segments' actions and the Root element's handlers.
 */
export function useSessionActions<T extends DateInputValue>(
  store: CalendarStore<SessionState>,
  options: SessionActionsOptions<T>
): SessionActions {
  const { basis, settings, boundary, rootRef, defaultValue, field } = options;
  const { revalidate } = field;

  // A new committed value, hour cycle or set of segments drops any draft typed over the old ones,
  // for good. A dropped draft no longer counts as incomplete, so an error it showed is checked again;
  // a change of value does that by itself, but a granularity change alone does not.
  useLayoutEffect(() => {
    const before = store.get();
    const after = rebase(before, basis);
    store.set(after);
    if (before.draft !== null && after.draft === null) {
      revalidate();
    }
  }, [store, basis, revalidate]);

  // Gestures read this render's options as one object at event time, so no single option can lag
  // on an older render's value.
  const eventProps = useRef(options);
  useLayoutEffect(() => {
    eventProps.current = options;
  });

  /** Applies a transition: reports its commit, keeps the edit unless the commit is canceled. */
  const run = useCallback(
    (transition: SessionTransition, event: Event, trigger: Element | undefined): void => {
      const before = store.get();
      const { commit } = transition;
      if (commit !== undefined) {
        const details = createChangeEventDetails(commit.reason, event, trigger, {
          getValidationError: () =>
            commit.value === null ? null : valueError(commit.value, eventProps.current.rules),
        });
        // SAFETY: the committed value is of the input's resolved kind, which is `T`'s.
        eventProps.current.onValueChange?.(commit.value as T | null, details);
        if (details.isCanceled) {
          store.set(canceled(before));
          return;
        }
      }
      store.set(transition.state);
      if (transition.focus !== undefined && trigger !== undefined) {
        focusSibling(rootRef.current, trigger, transition.focus, eventProps.current.neighbor);
      }
    },
    [store, rootRef]
  );

  const actions = useMemo(
    (): DateInputActions => ({
      keyDown(segment, event: KeyboardEvent<HTMLElement>) {
        const { settings: current } = eventProps.current;
        const { currentTarget, nativeEvent } = event;
        // A chord such as Cmd+ArrowUp, Alt+ArrowLeft or Ctrl+Backspace is the browser's or the
        // host's, as React Aria's segments leave it.
        if (event.ctrlKey || event.metaKey || event.altKey) {
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          focusSibling(
            rootRef.current,
            currentTarget,
            event.key === "ArrowRight" ? "next" : "previous",
            eventProps.current.neighbor
          );
          return;
        }
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          if (segment.isEditable) {
            run(erase(store.get(), segment, current), nativeEvent, currentTarget);
          }
          return;
        }
        if (!segment.isEditable || !current.editable) {
          return;
        }
        const transition = keyTransition(event.key, segment.type, current, store.get());
        if (transition !== undefined) {
          event.preventDefault();
          run(transition, nativeEvent, currentTarget);
        }
      },
      erase(segment, event, target) {
        run(erase(store.get(), segment, eventProps.current.settings), event, target);
      },
      type(type, key, event, target) {
        run(typeKey(store.get(), type, key, eventProps.current.settings), event, target);
      },
      segmentFocused() {
        store.set(segmentFocused(store.get()));
      },
      segmentRemoved(element) {
        focusAroundRemoved(rootRef.current, element);
      },
    }),
    [store, run, rootRef]
  );

  // Leaving the group confirms what the user typed, then the Field validates it.
  const endSession = useCallback(
    (event: Event): void => {
      run(confirm(store.get(), eventProps.current.settings), event, undefined);
      eventProps.current.field.blurred(store.get().edited);
    },
    [store, run]
  );
  // Whether focus left the group for a node inside the surrounding control's boundary, so the blur
  // waits for the control's `leave`.
  const away = useRef(false);
  useLayoutEffect(
    () =>
      boundary?.register({
        element: () => rootRef.current,
        leave(event) {
          if (away.current) {
            away.current = false;
            endSession(event);
          }
        },
      }),
    [boundary, rootRef, endSession]
  );

  // Focus that enters the group starts a session. Focus that leaves it confirms what the user typed
  // before the Field validates it. Focus that moves between the group's segments, or to or from a
  // node inside the control's boundary, does neither.
  const rootHandlers: SessionRootHandlers = {
    onFocus(event) {
      if (staysInside(event)) {
        return;
      }
      if (away.current) {
        away.current = false;
        return;
      }
      store.set(focusEntered(store.get()));
      field.setFocused(true);
    },
    onBlur(event) {
      if (staysInside(event)) {
        return;
      }
      const next = event.relatedTarget;
      if (isNode(next) && eventProps.current.boundary?.contains(next) === true) {
        away.current = true;
        return;
      }
      endSession(event.nativeEvent);
    },
    onPaste(event) {
      event.preventDefault();
      const trigger = isElement(event.target) ? event.target : undefined;
      run(
        paste(store.get(), event.clipboardData.getData("text"), eventProps.current.settings),
        event.nativeEvent,
        trigger
      );
    },
  };

  useFormReset(
    field.hiddenInput,
    settings.controlled
      ? null
      : () => {
          store.set(resetSession(defaultValue, settings.hourCycle, settings.fields, settings.units));
          field.reset();
        }
  );

  return { actions, rootHandlers };
}
