// A calendar Root's state, outside React: one value per Root that its parts read through
// `useSyncExternalStore`, each part through a selector that returns a primitive, or one state field
// by reference, as `visible` is read. A day button
// re-renders only when its own answer changes, so moving focus in a three-month view renders the
// two days it leaves and reaches, not the ~126 a context update would.
//
// The server and every hydrating part read the store's initial state, never the live one: a part
// whose Suspense boundary hydrates after the Root's effects ran (today read, a view opened) must
// still render what the server rendered, and React re-renders it with the live state once it has
// hydrated, as `chart-store.ts` does for a chart's entrance.

import { useSyncExternalStore } from "react";

/** A store's read side, which the shared parts take. */
export type ReadableCalendarStore<S> = {
  /** The current state. */
  readonly get: () => S;
  /** The state the store was created with, which the server rendered and hydration reads. */
  readonly initial: S;
  /** Calls `listener` after each change; returns the unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void;
};

/** A store a Root owns: the read side plus the one write. */
export type CalendarStore<S> = ReadableCalendarStore<S> & {
  /** Replaces the state and notifies every subscriber, unless `next` is the current state. */
  readonly set: (next: S) => void;
};

/**
 * A store holding `initial`.
 *
 * @template S - The state.
 * @param initial - The first state.
 * @returns The store.
 */
export function createCalendarStore<S>(initial: S): CalendarStore<S> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    initial,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next) {
      if (next === state) {
        return;
      }
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

/**
 * One field of a store's state by reference, re-rendering the caller only when that field's
 * reference changes. Taking a key rather than a selector means the snapshot is always a stored
 * reference: a selector that built a new object would never settle, re-rendering until React
 * throws. For a field the store keeps by reference across unrelated changes, such as `visible`,
 * which every write either carries over or replaces when the months change. The server and
 * hydration read the initial state, as `useCalendarSelector` does.
 *
 * @template S - The state.
 * @template K - The field's key.
 * @param store - The store.
 * @param key - The field to read.
 * @returns The field of the current state.
 */
export function useCalendarStateField<S, K extends keyof S>(store: ReadableCalendarStore<S>, key: K): S[K] {
  return useSyncExternalStore(
    store.subscribe,
    () => store.get()[key],
    () => store.initial[key]
  );
}

/** What a selector may return: a value `Object.is` compares by content. */
type Primitive = string | number | boolean | null | undefined;

/**
 * One answer about a store's state, re-rendering the caller only when the answer changes. The
 * server and hydration answer from the initial state, so a late-hydrating part matches the server
 * HTML; React then renders it again with the live answer.
 *
 * @template S - The state.
 * @template R - The answer, a primitive so equal answers compare equal.
 * @param store - The store.
 * @param select - Reads the answer from a state. It may close over render values.
 * @returns The answer for the current state.
 */
export function useCalendarSelector<S, R extends Primitive>(
  store: ReadableCalendarStore<S>,
  select: (state: S) => R
): R {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.initial)
  );
}
