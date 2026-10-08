"use client";

import { useCallback, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

// Base UI's own Field wiring, which its composite controls use. The phone field needs it to
// keep its country picker out of the field and to register the number it submits.
import { DEFAULT_FIELD_ROOT_STATE, DEFAULT_VALIDITY_STATE } from "@base-ui/react/internals/field-constants";
import { FieldRootContext, useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { LabelableProvider } from "@base-ui/react/internals/labelable-provider";
import { NOOP } from "@base-ui/react/internals/noop";

/**
 * Hands the number input's Field registration the number the field submits in place of the
 * display text the input holds, so a `Form` reads it for `onFormSubmit` while still focusing
 * the input on an error and checking its constraints. The input keeps its own
 * `${name}-display-value` DOM name, which the Field's `name` would otherwise replace.
 */
export function SubmittedValueControl({
  getSubmittedValue,
  children,
}: {
  getSubmittedValue: () => string;
  children: ReactNode;
}): ReactElement {
  const field = useFieldRootContext();
  const { registerFieldControl } = field;
  const register = useCallback<FieldRootContext["registerFieldControl"]>(
    (source, registration) =>
      registerFieldControl(source, registration && { ...registration, getValue: getSubmittedValue }),
    [registerFieldControl, getSubmittedValue]
  );
  const context = useMemo(
    () => ({ ...field, name: undefined, registerFieldControl: register }),
    [field, register]
  );
  return <FieldRootContext.Provider value={context}>{children}</FieldRootContext.Provider>;
}

/**
 * The Field context Base UI gives a control outside any Field: no name, registration,
 * validation or state to report to. Typed against Base UI's own context, so a change to it
 * fails the build here.
 */
const DETACHED_FIELD_CONTEXT: FieldRootContext = {
  invalid: undefined,
  name: undefined,
  validityData: { state: DEFAULT_VALIDITY_STATE, errors: [], error: "", value: "", initialValue: null },
  setValidityData: NOOP,
  disabled: undefined,
  setTouched: NOOP,
  setDirty: NOOP,
  setFilled: NOOP,
  setFocused: NOOP,
  validationMode: "onSubmit",
  shouldValidateOnChange: () => false,
  state: DEFAULT_FIELD_ROOT_STATE,
  registerFieldControl: NOOP,
  validation: {
    getValidationProps: (_disabled, props = {}) => props,
    inputRef: { current: null },
    registeredInputs: new Map(),
    registerInput: NOOP,
    getInputControl: () => null,
    commit: () => Promise.resolve(),
    change: NOOP,
  },
};

/**
 * Renders the country picker outside the phone field's Field, and outside any Field around
 * it: the detached context keeps the combobox from registering as a field's control or taking
 * its name, and its own labelable scope keeps the field's label and control id off it. It
 * keeps the field's disabled state, which a disabled `Field.Set` can set.
 */
export function CountryPickerScope({ children }: { children: ReactNode }): ReactElement {
  const { disabled } = useFieldRootContext();
  const context = useMemo(() => ({ ...DETACHED_FIELD_CONTEXT, disabled }), [disabled]);
  return (
    <FieldRootContext.Provider value={context}>
      <LabelableProvider>{children}</LabelableProvider>
    </FieldRootContext.Provider>
  );
}
