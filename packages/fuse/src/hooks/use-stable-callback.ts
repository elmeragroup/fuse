"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * A stable callback that calls the latest render's `callback`, for a context a memo keeps: a
 * gesture always reaches the render it happened in.
 *
 * @template A - The arguments.
 * @template R - The result.
 * @param callback - This render's callback.
 * @returns The stable callback.
 */
export function useStableCallback<A extends readonly unknown[], R>(
  callback: (...args: A) => R
): (...args: A) => R {
  const latest = useRef(callback);
  useLayoutEffect(() => {
    latest.current = callback;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}
