import type { ClassValue } from "clsx";

import { mergeClassName } from "../../styles/merge-class-name";

/**
 * A part's `className`, as Base UI's own parts take it: a string, or a callback of the part's state.
 *
 * @template State - The part's state.
 */
export type DatePickerClassName<State> = string | ((state: State) => string | undefined);

/**
 * A part's class for its state: the consumer's `className`, a string or a callback of the part's
 * state as Base UI parts take it, after the part's own classes. `useRender` resolves a callback only
 * when it is passed beside `props`, not inside them, so the pickers' parts resolve it here, with the
 * state they also hand `useRender`.
 *
 * @template State - The part's state.
 * @param className - The consumer's class or class callback.
 * @param state - The part's state.
 * @param classes - The part's own classes.
 * @returns The class string.
 */
export function stateClassName<State>(
  className: DatePickerClassName<State> | undefined,
  state: State,
  ...classes: ClassValue[]
): string {
  const merged = mergeClassName(className, ...classes);
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- mergeClassName returns a string or a state callback, Base UI's className contract.
  return typeof merged === "function" ? merged(state) : merged;
}
