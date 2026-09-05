"use client";

import { useCallback } from "react";
import type { Ref, RefCallback } from "react";

type InputRef<T> = Ref<T> | null | undefined;

function assignRef<T>(ref: InputRef<T>, instance: T): (() => void) | undefined {
  if (ref == null) {
    return undefined;
  }
  if ("current" in ref) {
    ref.current = instance;
    return () => {
      ref.current = null;
    };
  }
  const cleanup = ref(instance);
  if (cleanup == null) {
    return () => {
      ref(null);
    };
  }
  return cleanup;
}

/**
 * Merges two refs so overlay-trigger refs survive predictive-intent wiring.
 */
export function useMergedRefs<T>(first: InputRef<T>, second: InputRef<T>): RefCallback<T> | null {
  return useCallback(
    (instance: T) => {
      const firstCleanup = assignRef(first, instance);
      const secondCleanup = assignRef(second, instance);
      return () => {
        firstCleanup?.();
        secondCleanup?.();
      };
    },
    [first, second]
  );
}
