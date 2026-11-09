"use client";

// A date input as a Base UI Field control. Base UI's slot controls (OTPField, Select) work this way:
// the first editable segment registers as the control a Form focuses, its `getValue` is the ISO
// text, and a visually hidden text input carries the name, the value and the validity. The input
// installs its own message on that input with `setCustomValidity`, which Base UI's validation reads
// as the native error on blur, on submit and after a change, so it shows in `Field.Error` and blocks
// a submit. Outside any Field, Base UI's default context is a shared object of no-ops whose ref no
// input may take, so the hook leaves it alone and keeps the shown error itself.

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import { DEFAULT_VALIDITY_STATE } from "@base-ui/react/internals/field-constants";
import { useRegisterFieldControl } from "@base-ui/react/internals/field-register-control";
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useFormContext } from "@base-ui/react/internals/form-context";
import { useLabelableContext } from "@base-ui/react/internals/labelable-provider";
import { NOOP } from "@base-ui/react/internals/noop";
import { useValueChanged } from "@base-ui/react/internals/useValueChanged";

import type { DateInputValidationError } from "./date-input-validation";

/** What the Field integration reads from the input. */
export type DateInputFieldOptions = {
  /** The input's own `name`; a surrounding Field's wins. */
  readonly name: string | undefined;
  /** The input's own `disabled`; a surrounding Field's adds to it. */
  readonly disabled: boolean;
  /** The input's own `invalid`. */
  readonly invalid: boolean;
  /** The committed value's ISO text, `""` when empty. */
  readonly iso: string;
  /** The input's current error. */
  readonly error: DateInputValidationError | null;
  /** The message for the current error, `""` when valid. */
  readonly message: string;
  /** The first editable segment, read when a Form or the hidden input focuses it. */
  readonly firstSegment: RefObject<HTMLElement | null>;
};

/** The Field integration's answers and actions. */
export type DateInputField = {
  /** The name the ISO value submits under. */
  readonly name: string | undefined;
  /** Whether the input is disabled, by itself or by its Field. */
  readonly disabled: boolean;
  /** Whether the input shows as invalid. */
  readonly invalid: boolean;
  /** The id of the Field's label, which names the group and every segment. */
  readonly labelId: string | undefined;
  /** The ids of the Field's description and error. */
  readonly describedBy: string | undefined;
  /** The hidden input's id, which the Field's label points at. */
  readonly hiddenInputId: string;
  /** The hidden input's ref, which the form-reset subscription reads too. */
  readonly hiddenInput: RefObject<HTMLInputElement | null>;
  /** Focus entered or left the input. */
  readonly setFocused: (focused: boolean) => void;
  /** Focus left the input; `edited` commits its validation once the commit has rendered. */
  readonly blurred: (edited: boolean) => void;
  /**
   * What the input shows changed without a change of value, such as a dropped draft: a shown
   * error, or the Field's invalid state, is checked again once that change has rendered.
   */
  readonly revalidate: () => void;
  /**
   * A native form reset: the shown error and the Field's validity start over, and the reset's own
   * change of value, in the commit that renders it, does not validate again.
   */
  readonly reset: () => void;
};

/**
 * Registers a date input with its Field and Form, and keeps its validity on the hidden input.
 *
 * @param options - What the integration reads.
 * @param fallbackId - An id for the hidden input outside a Field.
 * @returns The answers and actions.
 */
export function useDateInputField(options: DateInputFieldOptions, fallbackId: string): DateInputField {
  const { iso, error, message, firstSegment } = options;
  const field = useFieldRootContext();
  const labelable = useLabelableContext();
  const { clearErrors } = useFormContext();
  const inField = field.setValidityData !== NOOP;
  const disabled = options.disabled || field.disabled === true;
  const name = field.name ?? options.name;
  const hiddenInputId = labelable.controlId ?? `${fallbackId}-input`;
  const hiddenInput = useRef<HTMLInputElement>(null);
  const [shownError, setShownError] = useState<DateInputValidationError | null>(null);
  const { validation, setFilled, setDirty, setTouched, setFocused, setValidityData } = field;

  // Base UI validates the hidden input as the Field's own; the ref is Base UI's to read.
  useLayoutEffect(() => {
    if (!inField) {
      return undefined;
    }
    const { inputRef } = validation;
    const node = hiddenInput.current;
    inputRef.current = node;
    return () => {
      if (inputRef.current === node) {
        inputRef.current = null;
      }
    };
  }, [inField, validation]);

  // The registration: the first segment is the control, the ISO text its value.
  const getValue = useCallback(() => hiddenInput.current?.value ?? "", []);
  useRegisterFieldControl(firstSegment, hiddenInputId, iso, getValue, !disabled, name);

  // The message is installed before any validation reads it.
  useLayoutEffect(() => {
    hiddenInput.current?.setCustomValidity(message);
  }, [message]);
  useLayoutEffect(() => {
    setFilled(iso !== "");
  }, [iso, setFilled]);

  // A changed value: a Form error under the name clears, and a shown error follows the value, as a
  // Field revalidates after a change. A reset's own change does not revalidate: after a failed
  // submit Base UI validates every change, which would flag a reset to an invalid value, such as
  // an empty required one, as soon as `reset` cleared it.
  const resetting = useRef(false);
  const initialValue = field.validityData.initialValue;
  useValueChanged(iso, () => {
    clearErrors(name);
    if (resetting.current) {
      validation.change(iso, true);
      return;
    }
    setDirty(iso !== initialValue);
    validation.change(iso);
    setShownError((shown) => (shown === null ? null : error));
  });
  // A reset counts only in the commit that renders it.
  useLayoutEffect(() => {
    resetting.current = false;
  });

  // Blur commits validation once the blur's own commit has rendered and installed its message.
  const [validationRequest, setValidationRequest] = useState(0);
  const handledRequest = useRef(0);
  useLayoutEffect(() => {
    if (handledRequest.current === validationRequest) {
      return;
    }
    handledRequest.current = validationRequest;
    setShownError(error);
    void validation.commit(iso);
  }, [validationRequest, error, iso, validation]);

  const blurred = useCallback(
    (edited: boolean) => {
      setFocused(false);
      setTouched(true);
      if (edited) {
        setValidationRequest((request) => request + 1);
      }
    },
    [setFocused, setTouched]
  );

  const errorShown = shownError !== null || field.state.valid === false;
  const revalidate = useCallback(() => {
    if (errorShown) {
      setValidationRequest((request) => request + 1);
    }
  }, [errorShown]);

  const reset = useCallback(() => {
    resetting.current = true;
    setShownError(null);
    setDirty(false);
    setTouched(false);
    // A reset value may equal the value before it, so no change revalidates the Field: its shown
    // validity starts over, as a native control's does.
    setValidityData((data) => ({ ...data, state: DEFAULT_VALIDITY_STATE, error: "", errors: [] }));
  }, [setDirty, setTouched, setValidityData]);

  const invalid =
    options.invalid || field.invalid === true || field.state.valid === false || shownError !== null;
  const describedBy = labelable.getDescriptionProps({})["aria-describedby"];

  return useMemo(
    (): DateInputField => ({
      name,
      disabled,
      invalid,
      labelId: labelable.labelId,
      describedBy,
      hiddenInputId,
      hiddenInput,
      setFocused,
      blurred,
      revalidate,
      reset,
    }),
    [
      name,
      disabled,
      invalid,
      labelable.labelId,
      describedBy,
      hiddenInputId,
      setFocused,
      blurred,
      revalidate,
      reset,
    ]
  );
}
