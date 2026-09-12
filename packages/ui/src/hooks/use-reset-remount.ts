"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { useFormReset } from "./use-form-reset";

export type ResetRemount = {
  /** Pass as `key` on the primitive root; it changes once per native reset. */
  key: number;
  /** `true` until the first reset remount; gates `autoFocus` so a remount cannot re-apply it. */
  isInitialMount: boolean;
};

/**
 * Package-private reset-by-remount for composites over a primitive that holds its own
 * uncontrolled value and does not observe native form reset (base-ui). The wrapper remounts
 * the primitive on reset by changing its `key`: that is what discards the committed value and
 * any in-progress text together, and `defaultValue` is read again on the fresh mount, as
 * React's own uncontrolled inputs read it only on mount. `enabled` is the ownership decision:
 * `false` for a controlled value, which is the parent's to keep, so no subscription is made.
 *
 * The remount replaces the focused node, so the hook remembers whether the control had focus
 * when reset fired and hands it back in a layout effect on the remount commit — before paint,
 * so the reset never drops focus. Focus is read from the control's own root, not the global
 * document: a document reports only the host for a control inside a shadow root, where the
 * shadow root itself holds the focused element. A reset remount is also a fresh mount from
 * React's point of view: re-applying `autoFocus` there would steal focus back, so callers
 * gate it on `isInitialMount`.
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
          const root = node?.getRootNode();
          const activeElement =
            root instanceof Document || root instanceof ShadowRoot ? root.activeElement : null;
          restoreFocusRef.current = activeElement === node;
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
