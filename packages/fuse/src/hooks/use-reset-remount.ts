"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { hasFocus } from "../internal/active-element";
import { useFormReset } from "./use-form-reset";

export type ResetRemount = {
  /** The `key` to pass on the primitive root. It changes once per native reset. */
  key: number;
  /**
   * Whether the first reset remount has not happened yet. Gate `autoFocus` on it, so a remount
   * cannot re-apply it.
   */
  isInitialMount: boolean;
};

/**
 * The remount key and first-mount flag for a composite over a Base UI primitive that holds its own
 * uncontrolled value and does not observe native form reset. The hook is package-private. The
 * wrapper remounts the primitive on reset by changing its `key`. The remount discards the committed
 * value and any in-progress text together, and the fresh mount reads `defaultValue` again, as React's own
 * uncontrolled inputs read it only on mount. `enabled` is the ownership decision. It is `false` for
 * a controlled value, which is the parent's to keep, so the hook makes no subscription.
 *
 * The remount replaces the focused node, so the hook remembers whether the control had focus when
 * reset fired. It hands focus back in a layout effect on the remount commit, before paint, so the
 * reset never drops focus. The hook reads focus from the control's own root, not the global
 * document. A document reports only the host for a control inside a shadow root, where the shadow
 * root itself holds the focused element. A reset remount is also a fresh mount from React's point of
 * view. Re-applying `autoFocus` there would steal focus back, so callers gate it on
 * `isInitialMount`.
 */
export function useResetRemount(
  element: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  enabled: boolean
): ResetRemount {
  const [resetEpoch, setResetEpoch] = useState(0);
  const restoreFocusRef = useRef(false);
  useFormReset(
    element,
    enabled
      ? () => {
          const node = element.current;
          restoreFocusRef.current = node !== null && hasFocus(node);
          setResetEpoch((epoch) => epoch + 1);
        }
      : null
  );
  useLayoutEffect(() => {
    if (!restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    element.current?.focus();
  }, [element, resetEpoch]);
  return { key: resetEpoch, isInitialMount: resetEpoch === 0 };
}
