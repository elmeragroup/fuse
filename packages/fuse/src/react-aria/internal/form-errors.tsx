"use client";

import { use, useCallback, useMemo } from "react";
import type { ContextType, ReactElement, ReactNode } from "react";

import { useFormContext } from "@base-ui/react/internals/form-context";
import { FormValidationContext } from "react-aria-components";

type ValidationErrors = ContextType<typeof FormValidationContext>;

/** The names a field submits under: one, or a range's start and end. */
type FieldNames = readonly [name: string | undefined, endName?: string | undefined];

/**
 * The bridge from Fuse `Form`'s `errors` to an interim React Aria field. React Aria reads server
 * errors only from its own `FormValidationContext`, which Base UI's `Form` does not provide, so
 * each field root sits inside `FormErrors` with the names it submits under.
 *
 * Both libraries show a new errors object again, so the bridge hands React Aria a new context
 * whenever `Form`'s errors object changes while it holds an entry for the field. That is why a
 * value change must also clear the key (`useClearFormErrors`): otherwise a sibling's edit, which
 * makes a new errors object, would show the error again.
 *
 * A field sees the outer React Aria context untouched, such as a React Aria `Form`'s
 * `validationErrors`, when it has no `Form` entry or when the outer context holds an entry under
 * one of its names. That keeps a form that passes the same errors to both working: swapping the
 * context when the `Form` key clears would make React Aria show the outer copy again.
 */
export function FormErrors({ names, children }: { names: FieldNames; children: ReactNode }): ReactElement {
  const { errors } = useFormContext();
  const outer = use(FormValidationContext);
  const [name, endName] = names;
  const value = useMemo(() => {
    if ([name, endName].some((key) => key !== undefined && Object.hasOwn(outer, key))) {
      return outer;
    }
    let merged: ValidationErrors | undefined;
    for (const key of [name, endName]) {
      const entry = key !== undefined && Object.hasOwn(errors, key) ? errors[key] : undefined;
      if (key !== undefined && entry !== undefined) {
        merged ??= { ...outer };
        merged[key] = entry;
      }
    }
    return merged ?? outer;
  }, [outer, errors, name, endName]);

  return <FormValidationContext.Provider value={value}>{children}</FormValidationContext.Provider>;
}

/**
 * Wraps a field's `onChange` so a value change clears the `Form` errors under its names, the
 * lifecycle `Form` gives Base UI fields. React Aria hides its own copy when it commits the change;
 * clearing the key keeps it hidden through the next errors object.
 */
export function useClearFormErrors<Value>(
  names: FieldNames,
  onChange: ((value: Value) => void) | undefined
): (value: Value) => void {
  const { clearErrors } = useFormContext();
  const [name, endName] = names;

  return useCallback(
    (value: Value) => {
      clearErrors(name);
      clearErrors(endName);
      onChange?.(value);
    },
    [clearErrors, name, endName, onChange]
  );
}
