"use client";

import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Package-private native form-reset subscription for uncontrolled field composites.
 * Observable only through those composites, never a public export. `onReset` is a
 * required `(() => void) | null`: each caller states the ownership decision explicitly,
 * so omitting the argument is a type error rather than a silent opt-out. The latest
 * callback is held in a ref and published in a layout effect, so a suspended or discarded
 * render cannot clear a committed subscription while identity changes do not resubscribe.
 *
 * The native `reset` event bubbles to the control's root with the form as its target.
 * `reset` is not composed, so a document listener never sees a control inside a shadow
 * root; subscribe on `element.current.getRootNode()` instead — the document or the
 * enclosing shadow root. The root is resolved once, on the first commit; the document
 * fallback covers a control that attaches later in the light DOM, while one that first
 * appears inside a shadow root after this effect has run is not covered. One listener
 * then resolves the association at event time: the callback runs when the resetting form
 * is whatever `element.current.form` is at that moment, so a control that moves between
 * forms or changes its `form` attribute is followed without a resubscribe, and a reset on
 * any other form is ignored. The listener is registered in capture phase, so a form that
 * stops propagation during dispatch cannot hide its own reset. The subscription lifecycle
 * is part of the runtime listener policy (performance.md §6).
 */
export function useFormReset(
  element: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  onReset: (() => void) | null
): void {
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
    let subscribed = true;
    function handleReset(event: Event): void {
      const node = element.current;
      // `node.form` is null for a control in no form; `event.target` is always the form.
      if (!node || event.target !== node.form) return;
      // A task runs after native reset, including reset-button default actions.
      setTimeout(() => {
        if (subscribed && !event.defaultPrevented) onResetRef.current?.();
      });
    }
    root.addEventListener("reset", handleReset, true);
    return () => {
      subscribed = false;
      root.removeEventListener("reset", handleReset, true);
    };
  }, [element, ownsReset]);
}
