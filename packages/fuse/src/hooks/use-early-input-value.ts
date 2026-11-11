"use client";

import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Package-private: hands a text field the value typed or autofilled into its server-rendered input
 * before hydration. That text survives hydration in the DOM, but the field's state starts from its
 * own initial value, and the first re-render, which Base UI's Field registration triggers in the
 * same commit, would write that value over it. The input is read once, in the first commit's layout
 * effect, before that re-render, and a value that differs from the shown one goes to `adopt` as an
 * edit, so a controlled parent can accept or reject it like any other. On a client mount, or a
 * hydration without an early edit, the two values are equal and nothing is proposed. StrictMode's
 * repeated mount effects keep the ref, so the value is proposed once.
 *
 * @param input - The field's input.
 * @param shownValue - The value the field renders into the input.
 * @param adopt - Receives the early value, or `null` while the field takes no edits, such as a
 *   disabled or read-only field.
 */
export function useEarlyInputValue(
  input: RefObject<HTMLInputElement | null>,
  shownValue: string,
  adopt: ((value: string) => void) | null
): void {
  const checkedRef = useRef(false);
  useLayoutEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    const element = input.current;
    if (element && adopt && element.value !== shownValue) {
      adopt(element.value);
    }
  });
}
