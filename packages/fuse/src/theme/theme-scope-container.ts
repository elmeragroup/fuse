"use client";

import { createContext, use, useEffect, useReducer, useSyncExternalStore } from "react";
import type { RefObject } from "react";

/** What `useResolvedPortalContainer` subscribes to for the enclosing scope's element. */
type ScopeElementSource = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => HTMLElement | null | undefined;
  getServerSnapshot: () => HTMLElement | null | undefined;
};

/**
 * One `ThemeScope`'s element as a store. The scope provides the store, never the element: a
 * context value that changes when the element attaches reaches Suspense boundaries that have
 * not hydrated yet, and React client-renders a boundary it cannot hydrate on the spot,
 * deleting the server's markers for content that is still streaming.
 */
export type ThemeScopeContainerStore = ScopeElementSource & {
  getSnapshot: () => HTMLElement | null;
  /** `null`: the server renders a scope without an element, so its overlays wait. */
  getServerSnapshot: () => null;
  /** The scope element's callback ref. */
  attach: (node: HTMLElement | null) => void;
  /**
   * Drops an element that was detached, never reattached and has left the document. React
   * deletes an element inside a hidden Suspense boundary without detaching its ref again, so
   * consumers call this after they commit, which they do once that boundary reveals.
   */
  revalidate: () => void;
};

export function createThemeScopeContainerStore(): ThemeScopeContainerStore {
  let element: HTMLElement | null = null;
  // Set by a detach and cleared by any attach, so a detach React follows with an attach (a
  // replacement, StrictMode's double attach, a reveal) is never acted on.
  let detached = false;
  const listeners = new Set<() => void>();
  const publish = (next: HTMLElement | null) => {
    if (next === element) {
      return;
    }
    element = next;
    for (const listener of listeners) {
      listener();
    }
  };
  const revalidate = () => {
    if (detached && element !== null && !element.isConnected) {
      publish(null);
    }
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => element,
    getServerSnapshot: () => null,
    attach(node) {
      if (node !== null) {
        detached = false;
        publish(node);
        return;
      }
      // React detaches the ref when a Suspense boundary hides already-shown content and on
      // StrictMode's double attach, and keeps the element in both. Notifying there would
      // re-render inside the commit for every hide and reveal, which can feed an update loop,
      // so the element is dropped only if nothing reattached by the next microtask and it has
      // left the document; a hidden element stays connected.
      detached = true;
      queueMicrotask(revalidate);
    },
    revalidate,
  };
}

export const ThemeScopeContainerContext = createContext<ThemeScopeContainerStore | undefined>(undefined);

function noSubscription(): () => void {
  return () => undefined;
}

function noElement(): undefined {
  return undefined;
}

// Stands in for the scope when an explicit container wins or no scope encloses the overlay.
const NO_SCOPE: ScopeElementSource = {
  subscribe: noSubscription,
  getSnapshot: noElement,
  getServerSnapshot: noElement,
};

function isElementRef(
  value: HTMLElement | RefObject<HTMLElement | null>
): value is RefObject<HTMLElement | null> {
  return "current" in value && !("nodeType" in value);
}

/**
 * Resolves the portal target for one overlay, in this order:
 * explicit `container` element or ref → nearest `ThemeScope` element → primitive
 * default. The three return arms are the whole contract, and every overlay reads
 * them the same way:
 *
 * - an `HTMLElement` — portal there;
 * - `null` — an explicit ref or an enclosing `ThemeScope` exists but its element is
 *   not attached yet, or the scope's element left the document, so the overlay
 *   renders nothing and waits. It must never briefly escape to `document.body`. A
 *   scope element that a Suspense boundary only hides stays the target. An overlay
 *   that mounts in the same commit as its scope sees the element after that commit's
 *   passive effects, since the scope never updates state while it commits;
 * - `undefined` — no scope and no explicit container, so the primitive's own default
 *   (`document.body`) stays in place.
 *
 * The canonical call site is `if (resolved === null) return null;` followed by
 * forwarding the value to the primitive's portal/container prop. Package-private:
 * neither this hook nor the underlying context is exported.
 */
export function useResolvedPortalContainer(
  container?: HTMLElement | RefObject<HTMLElement | null>
): HTMLElement | null | undefined {
  const store = use(ThemeScopeContainerContext);
  const scope = container === undefined ? (store ?? NO_SCOPE) : NO_SCOPE;
  const scopeElement = useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getServerSnapshot);
  const [, refresh] = useReducer((version: number) => version + 1, 0);
  const resolved =
    container === undefined ? scopeElement : isElementRef(container) ? container.current : container;

  // React attaches sibling refs during commit. One post-commit comparison makes
  // that attachment observable without polling or ever choosing a body fallback.
  useEffect(() => {
    if (container === undefined) {
      store?.revalidate();
    } else if (isElementRef(container) && container.current !== resolved) {
      refresh();
    }
  }, [container, resolved, store]);

  return resolved;
}
