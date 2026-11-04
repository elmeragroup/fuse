"use client";

/**
 * Whether a chart Root's plot parts may draw: closed on the server and while Root hydrates, then
 * open for the Root's life. Every chart family's Root owns one gate, so this module reads no Root
 * context.
 */
import { useState, useSyncExternalStore } from "react";

import { flushSync } from "react-dom";

/**
 * Whether a Root's plot parts may draw: closed on the server and while Root hydrates, then open
 * for the Root's life. Parts subscribe to it one by one, so opening it renders them without a
 * context update, and so without reaching a Suspense boundary that has not hydrated yet.
 */
export type DrawGate = {
  readonly open: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
  /** Open the gate, which renders every subscribed part. */
  readonly openNow: () => void;
};

/** A closed draw gate. */
export function createDrawGate(): DrawGate {
  let open = false;
  const listeners = new Set<() => void>();
  return {
    open: () => open,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    openNow() {
      if (open) return;
      open = true;
      for (const listener of listeners) listener();
    },
  };
}

/** The draw gate as the server and a hydrating part read it. */
function closedOnServer(): boolean {
  return false;
}

/**
 * Whether a Root's plot parts may draw, as a part renders it. The server and a hydrating part read
 * the gate closed, so a part whose Suspense boundary hydrates after Root measured still matches its
 * server HTML, and draws in the render React runs right after.
 *
 * @param gate - The Root's gate.
 * @returns Whether the gate is open.
 */
export function useDrawGateOpen(gate: DrawGate): boolean {
  return useSyncExternalStore(gate.subscribe, gate.open, closedOnServer);
}

/** The gates that open in the next microtask, all in one commit. */
const opening = new Set<DrawGate>();

/**
 * Open a hydrating Root's draw gate in a microtask after its hydration commit, before the task
 * ends. When the page is still hydrating other Suspense boundaries, as a page whose demos mount
 * Tabs above them does, React renders the sync work of the hydration commits again for every
 * boundary it hydrates on the way, and a gate opened in the commit would draw every mark in each
 * of those renders. The microtask runs once React has finished, before the browser paints, and
 * draws every hydrated Root's marks in one commit.
 *
 * @param gate - The Root's gate.
 */
export function openDrawingSoon(gate: DrawGate): void {
  if (opening.size === 0) {
    queueMicrotask(() => {
      const gates = [...opening];
      opening.clear();
      flushSync(() => {
        for (const each of gates) each.openNow();
      });
    });
  }
  opening.add(gate);
}

/**
 * Whether this part first rendered in a browser mount, as opposed to on the server or while it
 * hydrated server HTML. The server and hydration snapshot is `false`, and the first value stays,
 * so Root opens its draw gate in its first commit after a browser mount, and in a microtask after
 * a hydration commit.
 *
 * @returns `true` for a part that mounted in the browser without server HTML.
 */
export function useClientMount(): boolean {
  const client = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const [first] = useState(client);
  return first;
}

/** A store subscription for a value that never changes after hydration. */
export function subscribeNever(): () => void {
  return () => undefined;
}
