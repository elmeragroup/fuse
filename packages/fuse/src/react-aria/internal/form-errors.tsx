"use client";

import { use, useCallback, useMemo } from "react";
import type { ContextType } from "react";

import { useFormContext } from "@base-ui/react/internals/form-context";
import { FormValidationContext } from "react-aria-components";

type ValidationErrors = ContextType<typeof FormValidationContext>;

/** The names a field submits under: one, or a range's start and end. */
type FieldNames = readonly [name: string | undefined, endName?: string | undefined];

/** What a field root wires up: the context it provides, and the `onChange` it passes React Aria. */
type FormErrorsBridge<Value> = {
  validationErrors: ValidationErrors;
  onChange: (value: Value) => void;
};

/**
 * The bridge from Fuse `Form`'s `errors` to an interim React Aria field. React Aria reads server
 * errors only from its own `FormValidationContext`, which Base UI's `Form` does not provide, so
 * each field root provides `validationErrors` around itself and passes the returned `onChange`
 * to React Aria.
 *
 * Both libraries show a new errors object again, so `validationErrors` changes whenever `Form`'s
 * errors object changes while it holds an entry for the field. That is why `onChange` also clears
 * the keys, the lifecycle `Form` gives Base UI fields: React Aria hides its own copy when it
 * commits the change, and without the clear a sibling's edit, which makes a new errors object,
 * would show the error again.
 *
 * A field sees the outer React Aria context untouched, such as a React Aria `Form`'s
 * `validationErrors`, when it has no `Form` entry or when the outer context holds an entry under
 * one of its names. That keeps a form that passes the same errors to both working: swapping the
 * context when the `Form` key clears would make React Aria show the outer copy again.
 */
export function useFormErrors<Value>(
  names: FieldNames,
  onChange: ((value: Value) => void) | undefined
): FormErrorsBridge<Value> {
  const { errors, clearErrors } = useFormContext();
  const outer = use(FormValidationContext);
  const [name, endName] = names;

  const validationErrors = useMemo(() => {
    const keys = [name, endName].filter((key): key is string => key !== undefined);
    if (keys.some((key) => Object.hasOwn(outer, key))) {
      return outer;
    }
    let merged: ValidationErrors | undefined;
    for (const key of keys) {
      const entry = Object.hasOwn(errors, key) ? errors[key] : undefined;
      if (entry !== undefined) {
        merged ??= { ...outer };
        merged[key] = entry;
      }
    }
    return merged ?? outer;
  }, [outer, errors, name, endName]);

  const clearingOnChange = useCallback(
    (value: Value) => {
      clearErrors(name);
      clearErrors(endName);
      onChange?.(value);
    },
    [clearErrors, name, endName, onChange]
  );

  return { validationErrors, onChange: clearingOnChange };
}
