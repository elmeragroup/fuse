"use client";

import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Package-private native form-reset subscription for uncontrolled field composites.
 * Observable only through those composites, never a public export. `onReset` is null
 * when the caller does not own reset. The latest callback is held in a ref so identity
 * changes do not resubscribe.
 *
 * The native `reset` event bubbles to the document with the form as its target, so one
 * document listener resolves the association at event time: the callback runs when the
 * resetting form is whatever `element.current.form` is at that moment. A control that
 * mounts late, moves between forms, or changes its `form` attribute is therefore followed
 * without a resubscribe, and a reset on any other form is ignored.
 *
 * `element` is in the dependency list only because the effect reads it; a `RefObject` is
 * stable, so `ownsReset` is the one key that resubscribes.
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
    document.addEventListener("reset", handleReset);
    return () => {
      subscribed = false;
      document.removeEventListener("reset", handleReset);
    };
  }, [element, ownsReset]);
}
