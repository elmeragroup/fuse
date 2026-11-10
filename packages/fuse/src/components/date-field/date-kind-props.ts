// How the generic date components infer their value kind from the props written at a call site:
// the JSX side of `MadeValue`, which temporal-value.ts keeps beside the runtime's `madeKind`.

import type { MadeValue } from "../../temporal/temporal-value";

/** A prop's type in a props object: `undefined` when the object has no such key. */
type PropType<P, K extends string> = K extends keyof P ? P[K] : undefined;

/**
 * The value type a date component's props make when no value or default value names one:
 * `MadeValue` of the `granularity` and `timeZone` they hold. A component's value type defaults
 * to it, so a call site never names the kind.
 *
 * @template P - The props, as `KindProps` infers them.
 */
export type PropsMadeValue<P> = MadeValue<PropType<P, "granularity">, PropType<P, "timeZone">>;

/**
 * A props object mapped onto itself. TypeScript infers `P` from props through a mapped type like
 * this one even when they hold an unannotated callback, which keeps it from inferring a type
 * parameter from the whole object, and the inference keeps a prop's own type: an optional
 * `timeZone` stays `string | undefined`, where inferring from the prop alone drops the
 * `undefined`. `granularity` and `timeZone` keep their types; the component's other declared props,
 * React's `key` and hyphenated attributes add nothing; any other key is `never`, so a misspelt or
 * undeclared prop is an error. A spread object's keys are checked like written ones, unlike on a
 * component that is not generic, so destructure the keys the component does not take, such as a
 * react-hook-form field's `ref` or a wrapper's own props, before spreading the rest. The same
 * rule makes the old form that named the kind as a type argument fail:
 * `<DateField<Temporal.PlainDate>>` binds `P` to PlainDate, whose members the props then need,
 * each as `never`.
 *
 * @template P - The props.
 * @template Declared - The component's props type, whose keys are the props it takes.
 */
export type KindProps<P, Declared> = {
  [K in keyof P]: K extends "granularity" | "timeZone"
    ? P[K]
    : K extends keyof Declared | "key" | `${string}-${string}`
      ? unknown
      : never;
};

/**
 * The props type argument of a date component composed inside another whose own `T` already
 * names the kind: no props name the kind, so `T` is given alongside it.
 */
export type KindFromValue = object;
