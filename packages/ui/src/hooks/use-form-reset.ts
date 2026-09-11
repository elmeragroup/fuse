"use client";

import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Package-private native form-reset subscription for uncontrolled field composites.
 * Observable only through those composites, never a public export. `onReset` is `null`
 * — this hook family's "off" signal, matching `usePhoneNumberFieldState` — when the
 * caller does not own reset. The latest callback is held in a ref so identity changes
 * do not resubscribe.
 *
 * The native `reset` event bubbles to the control's root with the form as its target.
 * `reset` is not composed, so a document listener never sees a control inside a shadow
 * root; subscribe on `element.current.getRootNode()` instead — the document or the
 * enclosing shadow root. One listener resolves the association at event time: the
 * callback runs when the resetting form is whatever `element.current.form` is at that
 * moment. A control that mounts late, moves between forms, or changes its `form`
 * attribute is therefore followed without a resubscribe, and a reset on any other form
 * is ignored.
 */
export function useFormReset(
  element: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  onReset: (() => void) | null
): void {
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;
  const ownsReset = onReset !== null;

  useLayoutEffect(() => {
    if (!ownsReset) return;
    // Layout effects run after mount, so the node exists; the document fallback only
    // covers a ref that never attached.
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
    root.addEventListener("reset", handleReset);
    return () => {
      subscribed = false;
      root.removeEventListener("reset", handleReset);
    };
  }, [element, ownsReset]);
}
