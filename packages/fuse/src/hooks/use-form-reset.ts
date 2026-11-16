"use client";

import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

type ResetControl = HTMLInputElement | HTMLTextAreaElement;

/** One committed subscription. Each effect run makes a fresh object, so its identity is the token. */
type Subscriber = {
  readonly element: RefObject<ResetControl | null>;
  readonly onReset: RefObject<(() => void) | null>;
};

/** The subscribers of one root and the single capture listener that serves them. */
type RootPool = {
  readonly subscribers: Set<Subscriber>;
  readonly listener: (event: Event) => void;
};

const pools = new WeakMap<Node, RootPool>();

function createPool(): RootPool {
  const subscribers = new Set<Subscriber>();
  function listener(event: Event): void {
    // Match at dispatch time, as one listener per subscriber did: the snapshot leaves out a
    // subscriber added during this dispatch, just as a listener added then would not run.
    for (const subscriber of [...subscribers]) {
      const node = subscriber.element.current;
      // `node.form` is null for a control in no form; `event.target` is always the form.
      if (!node || event.target !== node.form) continue;
      // A task runs after native reset, including reset-button default actions. One task per
      // subscriber keeps each callback isolated as before: a throw, or the render a callback's
      // update flushes before the next task, cannot reach the other subscribers.
      setTimeout(() => {
        if (subscribers.has(subscriber) && !event.defaultPrevented) subscriber.onReset.current?.();
      });
    }
  }
  return { subscribers, listener };
}

function subscribe(root: Node, subscriber: Subscriber): () => void {
  let pool = pools.get(root);
  if (!pool) {
    pool = createPool();
    pools.set(root, pool);
    root.addEventListener("reset", pool.listener, true);
  }
  pool.subscribers.add(subscriber);
  const owned = pool;
  return () => {
    owned.subscribers.delete(subscriber);
    if (owned.subscribers.size > 0) return;
    root.removeEventListener("reset", owned.listener, true);
    pools.delete(root);
  };
}

/**
 * Subscribes a control to native form reset. The hook is package-private, for uncontrolled field
 * composites and for a control whose DOM a reset empties under a controlled value, such as
 * FileUpload's posted files. It is observable only through those composites, never as a public
 * export. `onReset` is a required `(() => void) | null`. Each caller states the ownership decision
 * explicitly, so omitting the argument is a type error rather than a silent opt-out. The hook holds
 * the latest callback in a ref and publishes it in a layout effect, so a suspended or discarded
 * render cannot clear a committed subscription, and identity changes do not resubscribe.
 *
 * The native `reset` event bubbles to the control's root with the form as its target. `reset` is
 * not composed, so a document listener never sees a control inside a shadow root. The hook
 * subscribes on `element.current.getRootNode()` instead, which is the document or the enclosing
 * shadow root. It resolves the root once, on the first commit. The document fallback covers a
 * control that attaches later in the light DOM. It does not cover a control that first appears
 * inside a shadow root after this effect has run.
 *
 * Every checked control subscribes, as do the text fields, so a table with a checkbox per row holds
 * many subscriptions. They share one capture listener per root, added with the root's first
 * subscriber and removed with its last. That listener resolves each association at event time. A
 * callback runs when the resetting form is whatever `element.current.form` is at that moment, so the
 * hook follows a control that moves between forms or changes its `form` attribute without a
 * resubscribe, and ignores a reset on any other form. The listener registers in the capture phase,
 * so a form that stops propagation during dispatch cannot hide its own reset.
 */
export function useFormReset(element: RefObject<ResetControl | null>, onReset: (() => void) | null): void {
  const onResetRef = useRef(onReset);
  useLayoutEffect(() => {
    onResetRef.current = onReset;
  });
  const ownsReset = onReset !== null;

  useLayoutEffect(() => {
    if (!ownsReset) return;
    // Layout effects run after mount, so an attached control resolves its real root here;
    // the document fallback covers a ref that attaches later in the light DOM.
    const root = element.current?.getRootNode() ?? document;
    return subscribe(root, { element, onReset: onResetRef });
  }, [element, ownsReset]);
}
