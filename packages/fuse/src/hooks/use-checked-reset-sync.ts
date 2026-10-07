"use client";

import { useReducer, useRef } from "react";
import type { Ref, RefCallback } from "react";

import { useFormReset } from "./use-form-reset";
import { useMergedRefs } from "./use-merged-refs";

/**
 * Package-private native form-reset sync for the Base UI checked controls: Checkbox,
 * CheckboxCard, Switch, RadioGroupItem and RadioIconButton. Base UI renders a hidden input
 * whose `checked` React writes from the control's state on each render, but it does not observe
 * native form reset. A native reset, which React also runs after a form action, puts that input
 * back to its mount-time state while the control keeps showing its current state, so the next submit
 * sends what is not on screen.
 *
 * The hook re-renders the control after each reset of its form, and React writes the shown state
 * back into the same hidden input. Every control subscribes, controlled or not, and a group member
 * reads its state from the group, so no group wiring is needed. The selection stays as it is:
 * an uncontrolled control does not return to its default (see `TODO.md`). Nothing remounts and
 * no value changes, so focus, validity and `Form` errors stay. Returns `inputRef` merged with the
 * hidden input ref the subscription reads.
 */
export function useCheckedResetSync(
  inputRef: Ref<HTMLInputElement> | undefined
): RefCallback<HTMLInputElement> | null {
  const hiddenInput = useRef<HTMLInputElement>(null);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  useFormReset(hiddenInput, rerender);
  return useMergedRefs(inputRef, hiddenInput);
}
