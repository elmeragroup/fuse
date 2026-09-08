"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Package-private native form-reset subscription for uncontrolled field composites.
 * Observable only through those composites, never a public export. `onReset` is null
 * when the caller does not own reset. The latest callback is held in a ref so identity
 * changes do not resubscribe. `formId` is the control's `form` attribute so an external
 * association can change without replacing the element.
 */
export function useFormReset(
  element: HTMLInputElement | HTMLTextAreaElement | null,
  onReset: (() => void) | null,
  formId?: string
): void {
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;
  const ownsReset = onReset !== null;

  useLayoutEffect(() => {
    const form = element?.form;
    if (!element || !form || !ownsReset) return;
    let subscribed = true;
    function handleReset(event: Event): void {
      // A task runs after native reset, including reset-button default actions.
      setTimeout(() => {
        if (subscribed && !event.defaultPrevented) onResetRef.current?.();
      });
    }
    form.addEventListener("reset", handleReset);
    return () => {
      subscribed = false;
      form.removeEventListener("reset", handleReset);
    };
  }, [element, ownsReset, formId]);
}
