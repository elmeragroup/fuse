"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";

import { useFormReset } from "../../hooks/use-form-reset";
import { createChangeEventDetails } from "../calendar/calendar-change-details";
import { createCalendarStore } from "../calendar/calendar-store";
import type { DateInputResetOwner } from "../date-field/date-input-reset";
import type { DatePickerOpenChangeEventDetails } from "./picker-change-details";
import type { PickerOpenRequest } from "./picker-change-details";
import {
  commit as commitValue,
  commitHolding as commitValueHolding,
  committedNow,
  follow,
  heldFor,
  hold as holdSelection,
  initialPickerSession,
  opened,
  resetPickerSession,
  settle,
} from "./picker-session";
import type {
  PickerCommitted,
  PickerHeld,
  PickerHeldOrigin,
  PickerSessionState,
  PickerValueOwner,
} from "./picker-session";

/**
 * What a picker Root hands its session.
 *
 * @template V - What the picker holds.
 * @template C - The committed value.
 */
export type PickerSessionOptions<V, C, R extends string> = {
  /** The parent's open state, or `undefined` while the picker owns it. */
  readonly open: boolean | undefined;
  /** Whether the popup starts open. */
  readonly defaultOpen: boolean;
  /** The Root's `onOpenChange`. */
  readonly onOpenChange: ((open: boolean, details: DatePickerOpenChangeEventDetails) => void) | undefined;
  /** The parent's committed value while the parent controls it, else `undefined`. */
  readonly parent: { readonly value: C } | undefined;
  /** The picker's own first value, which a native form reset puts back. */
  readonly defaultValue: C;
  /** Returns a committed value's key, which a held selection belongs to. Pass a module function. */
  readonly keyOf: (value: C) => string;
  /** Returns the draft to show when the picker holds no selection. Pass a module function. */
  readonly draftOf: (value: C) => V;
  /**
   * Commits a held selection the close finalizes, through the Root's cancelable `onValueChange`.
   * Returns whether it applied; a canceled commit keeps the popup open.
   */
  readonly finalize: (value: V, origin: PickerHeldOrigin<R>) => boolean;
  /** Called when a native form reset reaches the picker, after the session put its value back. */
  readonly onReset: () => void;
};

/** The committed value and the held selection as they are now, for a gesture. */
export type PickerSessionNow<V, C, R extends string> = {
  /** The committed value. */
  readonly value: C;
  /** The held selection over it, or `null`. */
  readonly held: PickerHeld<V, R> | null;
  /** What the gesture edits: the held selection, or the committed value's draft. */
  readonly draft: V;
};

/**
 * A picker's edit session as React state.
 *
 * @template V - What the picker holds.
 * @template C - The committed value.
 */
export type PickerSession<V, C, R extends string> = {
  /** Whether the popup is open: the parent's state, or the session's own. */
  readonly open: boolean;
  /** The committed value this render: the parent's, or the picker's own. */
  readonly value: C;
  /** The committed value's key. */
  readonly basis: string;
  /** The held selection over the current committed value, or `null`. */
  readonly held: PickerHeld<V, R> | null;
  /** What the picker shows this render: the held selection, or the committed value's draft. */
  readonly draft: V;
  /**
   * The form-reset generation. The calendars' views start over by it, and a range's end uses it to
   * recognize the commit that renders a reset.
   */
  readonly generation: number;
  /**
   * Reads the session as a commit or hold earlier in the same task left it, for a gesture; see
   * `usePickerSession`.
   */
  readonly now: () => PickerSessionNow<V, C, R>;
  /** Opens or closes the popup as one transaction; see `usePickerSession`. */
  readonly requestOpen: PickerOpenRequest;
  /**
   * Applies a commit the Root's `onValueChange` accepted; see `usePickerSession`. What was held
   * stays, and lapses once the value moves off its basis.
   */
  readonly commit: (value: C) => void;
  /** Applies a commit, as `commit` does, and holds a selection over the value committed, or nothing. */
  readonly commitHolding: (value: C, held: V | null) => void;
  /** Holds a selection over the committed value. */
  readonly hold: (value: V, finalizeOnClose: PickerHeldOrigin<R> | null) => void;
  /** Holds an edit of what the picker holds, which the close still commits if it did before. */
  readonly edit: (value: V) => void;
  /** A name-less hidden input for the Root to render, which ties the form-reset subscription to its form. */
  readonly resetRef: RefObject<HTMLInputElement | null>;
  /** The object the Root's inputs register their form reset with; see `date-input-reset.ts`. */
  readonly resetOwner: DateInputResetOwner;
};

/**
 * A picker's edit session. It stores the committed value and the held selection, and runs the open
 * transitions and the form reset.
 *
 * - The committed value lives in the session's store, so a gesture reads what a commit earlier in
 *   the same task left, through `now`. The picker's own value follows each commit; a parent's value
 *   is its `value` prop, which the session follows once it renders. A parent's commit is pending
 *   until then, and only gestures in the same task read it. The parent's next render ends it, and
 *   so does a microtask queued with it, so a change the parent declines without rendering leaves
 *   nothing behind for the next task.
 * - Closing is one transaction: a held selection marked `finalizeOnClose` commits first, through the
 *   Root's cancelable `onValueChange`, and a canceled commit keeps the popup open; then `onOpenChange`
 *   reports the close, and a canceled close keeps it open with the selection committed.
 * - A parent that closes the popup itself, `open` going from `true` to `false`, finalizes the held
 *   selection the same way, after the fact.
 * - A held selection belongs to the committed value it was made over: once that value changes it is
 *   gone for good, so restoring the old value never resurrects it.
 * - A native form reset puts the picker's own value back to its default, drops the held selection,
 *   bumps `generation` and calls `onReset`. The calendar's view starts over by `generation`, even
 *   when the value is unchanged. In the same task, the reset also resets every input registered with
 *   `resetOwner`. Each input drops its draft and shown validity and takes the value put back as the
 *   reset's own change, which validates nothing.
 *
 * @template V - What the picker holds.
 * @template C - The committed value.
 * @template R - The gestures that make a selection.
 * @param options - The Root's open and value props, finalizer and reset.
 * @returns The session.
 */
export function usePickerSession<V, C, R extends string>(
  options: PickerSessionOptions<V, C, R>
): PickerSession<V, C, R> {
  const { keyOf, draftOf, parent } = options;
  const committed = useCallback(
    (next: C): PickerCommitted<C> => ({ value: next, basis: keyOf(next) }),
    [keyOf]
  );
  const [store] = useState(() =>
    createCalendarStore(
      initialPickerSession<V, C, R>(
        options.defaultOpen,
        committed(parent === undefined ? options.defaultValue : parent.value)
      )
    )
  );
  const state: PickerSessionState<V, C, R> = useSyncExternalStore(
    store.subscribe,
    store.get,
    () => store.initial
  );
  const open = options.open ?? state.open;
  const owner: PickerValueOwner = parent === undefined ? "picker" : "parent";
  const value = parent === undefined ? state.value : parent.value;
  const basis = parent === undefined ? state.basis : keyOf(parent.value);
  const held = heldFor(state, basis);
  const valueDraft = useMemo(() => draftOf(value), [draftOf, value]);
  const latest = useRef({ ...options, open, owner });
  useLayoutEffect(() => {
    latest.current = { ...options, open, owner };
  });

  // A parent's value is the committed value once it renders. Following it drops a selection made
  // over another value for good, and render already ignores that selection. While the key stays the
  // same, following only ends a pending commit.
  useLayoutEffect(() => {
    if (parent !== undefined) {
      store.set(follow(store.get(), { value, basis }));
    }
  });

  const now = useCallback((): PickerSessionNow<V, C, R> => {
    const current = store.get();
    const builtOn = committedNow(current);
    const heldNow = heldFor(current, builtOn.basis);
    return { value: builtOn.value, held: heldNow, draft: heldNow?.value ?? draftOf(builtOn.value) };
  }, [store, draftOf]);

  const requestOpen = useCallback<PickerOpenRequest>(
    (next, reason, event, trigger) => {
      const current = latest.current;
      if (current.open === next) {
        return false;
      }
      if (!next) {
        const { held: closing } = now();
        if (closing?.finalizeOnClose != null && !current.finalize(closing.value, closing.finalizeOnClose)) {
          return false;
        }
      }
      const details = createChangeEventDetails(reason, event, trigger, {});
      current.onOpenChange?.(next, details);
      if (details.isCanceled) {
        return false;
      }
      latest.current = { ...latest.current, open: next };
      store.set(opened(store.get(), next));
      return true;
    },
    [store, now]
  );

  // A parent that closes the popup itself still finalizes what the popup held.
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) {
      return;
    }
    const { held: closing } = now();
    if (closing?.finalizeOnClose != null) {
      latest.current.finalize(closing.value, closing.finalizeOnClose);
    }
    store.set(opened(store.get(), false));
  }, [store, now, open]);

  // A parent's commit stays pending until the end of its task at most. If the parent declines the
  // change without rendering, the follow effect does not run. The queued microtask clears the
  // pending commit.
  const applyCommit = useCallback(
    (next: PickerSessionState<V, C, R>) => {
      store.set(next);
      if (next.pending !== null) {
        queueMicrotask(() => store.set(settle(store.get())));
      }
    },
    [store]
  );
  const commit = useCallback(
    (next: C) => applyCommit(commitValue(store.get(), committed(next), latest.current.owner)),
    [store, committed, applyCommit]
  );
  const commitHolding = useCallback(
    (next: C, held: V | null) =>
      applyCommit(commitValueHolding(store.get(), committed(next), latest.current.owner, held)),
    [store, committed, applyCommit]
  );
  const hold = useCallback(
    (selection: V, finalizeOnClose: PickerHeldOrigin<R> | null) => {
      store.set(holdSelection(store.get(), selection, finalizeOnClose));
    },
    [store]
  );
  // Whether the close commits a selection belongs to the selection, not to the edit that changes it.
  const edit = useCallback(
    (selection: V) => hold(selection, now().held?.finalizeOnClose ?? null),
    [hold, now]
  );

  const resetRef = useRef<HTMLInputElement>(null);
  const [inputResets] = useState(() => new Set<() => void>());
  const resetOwner = useMemo(
    (): DateInputResetOwner => ({
      register(reset) {
        inputResets.add(reset);
        return () => {
          inputResets.delete(reset);
        };
      },
    }),
    [inputResets]
  );
  useFormReset(resetRef, () => {
    const current = latest.current;
    // The picker's own value goes back to its default. A parent's value stays, as a controlled
    // native input's does.
    const back = current.parent === undefined ? current.defaultValue : current.parent.value;
    store.set(resetPickerSession(store.get(), committed(back)));
    current.onReset();
    for (const reset of inputResets) {
      reset();
    }
  });

  return {
    open,
    value,
    basis,
    held,
    draft: held?.value ?? valueDraft,
    generation: state.generation,
    now,
    requestOpen,
    commit,
    commitHolding,
    hold,
    edit,
    resetRef,
    resetOwner,
  };
}
