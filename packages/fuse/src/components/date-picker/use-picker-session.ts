"use client";

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";

import { useFormReset } from "../../hooks/use-form-reset";
import { createChangeEventDetails } from "../calendar/calendar-change-details";
import { createCalendarStore } from "../calendar/calendar-store";
import type { DatePickerOpenChangeEventDetails } from "./picker-change-details";
import type { PickerOpenRequest } from "./picker-change-details";
import {
  heldFor,
  hold as holdSelection,
  initialPickerSession,
  opened,
  rebase,
  release as releaseSelection,
  resetPickerSession,
} from "./picker-session";
import type { PickerHeld, PickerHeldOrigin, PickerSessionState } from "./picker-session";

/**
 * What a picker Root hands its session.
 *
 * @template V - What the picker holds.
 */
export type PickerSessionOptions<V, R extends string> = {
  /** The parent's open state, or `undefined` while the picker owns it. */
  readonly open: boolean | undefined;
  /** Whether the popup starts open. */
  readonly defaultOpen: boolean;
  /** The Root's `onOpenChange`. */
  readonly onOpenChange: ((open: boolean, details: DatePickerOpenChangeEventDetails) => void) | undefined;
  /** The committed value's key, which a held selection belongs to. */
  readonly basis: string;
  /**
   * Commit a held selection the close finalizes, through the Root's cancelable `onValueChange`.
   * Returns whether it applied; a canceled commit keeps the popup open.
   */
  readonly finalize: (value: V, origin: PickerHeldOrigin<R>) => boolean;
  /** A native form reset reached the picker: put the owned value back to its default. */
  readonly onReset: () => void;
};

/**
 * A picker's edit session as React state.
 *
 * @template V - What the picker holds.
 */
export type PickerSession<V, R extends string> = {
  /** Whether the popup is open: the parent's state, or the session's own. */
  readonly open: boolean;
  /** The held selection over the current committed value, or `null`. */
  readonly held: PickerHeld<V, R> | null;
  /** The form-reset generation the parts key what starts over by. */
  readonly generation: number;
  /** Open or close the popup as one transaction; see `usePickerSession`. */
  readonly requestOpen: PickerOpenRequest;
  /**
   * Hold a selection over the committed value: the current one, or the `basis` of the value a
   * commit in the same gesture has just made, which the Root has not rendered yet.
   */
  readonly hold: (value: V, finalizeOnClose: PickerHeldOrigin<R> | null, basis?: string) => void;
  /** Drop the held selection. */
  readonly release: () => void;
  /** A name-less hidden input for the Root to render, which ties the form-reset subscription to its form. */
  readonly resetRef: RefObject<HTMLInputElement | null>;
};

/**
 * The one owner of a picker's held selection, open transitions and form reset.
 *
 * - Closing is one transaction: a held selection marked `finalizeOnClose` commits first, through the
 *   Root's cancelable `onValueChange`, and a canceled commit keeps the popup open; then `onOpenChange`
 *   reports the close, and a canceled close keeps it open (with the selection committed).
 * - A parent that closes the popup itself (`open` going from `true` to `false`) finalizes the held
 *   selection the same way, after the fact.
 * - A held selection belongs to the committed value it was made over: once that value changes it is
 *   gone for good, so restoring the old value never resurrects it.
 * - A native form reset drops the held selection, bumps `generation` (the Root keys its inputs and
 *   calendar by it, so drafts, shown validity and the view start over even when the value is
 *   unchanged) and calls `onReset`.
 *
 * @template V - What the picker holds.
 * @template R - The gestures that make a selection.
 * @param options - The Root's open props, committed key, finalizer and reset.
 * @returns The session.
 */
export function usePickerSession<V, R extends string>(
  options: PickerSessionOptions<V, R>
): PickerSession<V, R> {
  const [store] = useState(() => createCalendarStore(initialPickerSession<V, R>(options.defaultOpen)));
  const state: PickerSessionState<V, R> = useSyncExternalStore(
    store.subscribe,
    store.get,
    () => store.initial
  );
  const open = options.open ?? state.open;
  const latest = useRef({ ...options, open });
  useLayoutEffect(() => {
    latest.current = { ...options, open };
  });

  // A selection made over another committed value is dropped for good (render already ignores it).
  const { basis } = options;
  useLayoutEffect(() => {
    store.set(rebase(store.get(), basis));
  }, [store, basis]);

  const requestOpen = useCallback<PickerOpenRequest>(
    (next, reason, event, trigger) => {
      const current = latest.current;
      if (current.open === next) {
        return false;
      }
      if (!next) {
        const held = heldFor(store.get(), current.basis);
        if (held?.finalizeOnClose != null && !current.finalize(held.value, held.finalizeOnClose)) {
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
    [store]
  );

  // A parent that closes the popup itself still finalizes what the popup held.
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) {
      return;
    }
    const held = heldFor(store.get(), latest.current.basis);
    if (held?.finalizeOnClose != null) {
      latest.current.finalize(held.value, held.finalizeOnClose);
    }
    store.set(opened(store.get(), false));
  }, [store, open]);

  const hold = useCallback(
    (value: V, finalizeOnClose: PickerHeldOrigin<R> | null, basis = latest.current.basis) => {
      store.set(holdSelection(store.get(), { basis, value, finalizeOnClose }));
    },
    [store]
  );
  const release = useCallback(() => store.set(releaseSelection(store.get())), [store]);

  const resetRef = useRef<HTMLInputElement>(null);
  useFormReset(resetRef, () => {
    store.set(resetPickerSession(store.get()));
    latest.current.onReset();
  });

  return {
    open,
    held: heldFor(state, basis),
    generation: state.generation,
    requestOpen,
    hold,
    release,
    resetRef,
  };
}
