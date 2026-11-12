"use client";

// FileUpload as a Base UI Field control, the way Select joins one: the Trigger is the control a
// Form focuses on an invalid submit, the controlled `files` are its value, and the Root's validity
// input, a file input that holds exactly `files`, carries the native validity Base UI reads, so
// `required` with no files is `valueMissing` for `Field.Error` and the Form.
//
// Validation follows a change of `files`, as Select's and Checkbox's follow their value: Base UI
// then validates at once in `onChange` mode, and after a failed submit in `onSubmit` mode. The
// Trigger's blur marks the Field touched and, in `onBlur` mode, commits validation, as
// Select.Trigger's and Checkbox's blur do. Opening the OS picker blurs the window, which blurs the
// Trigger while it stays its root's active element; that blur is no leaving of the control, so it
// commits nothing before the user has picked. Outside any Field, Base UI's default context is a
// shared object of no-ops whose ref no input may take, so both hooks leave it alone.

import { useCallback, useLayoutEffect, useState } from "react";
import type { FocusEvent, RefObject } from "react";

import { useRegisterFieldControl } from "@base-ui/react/internals/field-register-control";
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useFormContext } from "@base-ui/react/internals/form-context";
import { useLabelableContext } from "@base-ui/react/internals/labelable-provider";
import { NOOP } from "@base-ui/react/internals/noop";
import { useValueChanged } from "@base-ui/react/internals/useValueChanged";

import { hasFocus } from "../../internal/active-element";

/** What the Field integration reads from the Root. */
export type FileUploadFieldOptions = {
  /** The controlled files, an empty list when the Root has none. */
  readonly files: readonly File[];
  /** The Root's own `name`; a surrounding Field's wins. */
  readonly name: string | undefined;
  /** Whether the Root is disabled, by itself or by its Field. A disabled control is not validated. */
  readonly disabled: boolean;
  /** The Trigger a Form focuses on an invalid submit. */
  readonly trigger: RefObject<HTMLElement | null>;
  /** The input whose native validity Base UI reads, mounted while it is needed. */
  readonly validityInput: RefObject<HTMLInputElement | null>;
};

/** Whether `left` and `right` hold the same files in the same order. */
function sameFiles(left: readonly File[], right: readonly File[]): boolean {
  return left.length === right.length && left.every((file, index) => file === right[index]);
}

/** What the Field integration gives the Root. */
export type FileUploadField = {
  /** Whether the Root is inside a Field, whose validation then needs the validity input. */
  readonly inField: boolean;
  /**
   * What a Trigger calls once focus has left it: it marks the Field touched and, in the Field's
   * `onBlur` mode, validates the files.
   */
  readonly triggerLeft: () => void;
};

/**
 * Registers a FileUpload with its Field and Form, and points the Field's validation at the
 * validity input.
 *
 * @param options - What the integration reads.
 * @returns Whether the Root is in a Field, and what a Trigger calls once focus has left it.
 */
export function useFileUploadField(options: FileUploadFieldOptions): FileUploadField {
  const { files, trigger, validityInput } = options;
  const field = useFieldRootContext();
  const { clearErrors } = useFormContext();
  const { controlId } = useLabelableContext();
  const inField = field.setValidityData !== NOOP;
  const name = field.name ?? options.name;
  const { validation, validationMode, setFilled, setDirty, setTouched } = field;
  const enabled = inField && !options.disabled;

  // Base UI validates the validity input as the Field's own; the ref is Base UI's to read.
  useLayoutEffect(() => {
    if (!inField) {
      return undefined;
    }
    const { inputRef } = validation;
    const node = validityInput.current;
    inputRef.current = node;
    return () => {
      if (inputRef.current === node) {
        inputRef.current = null;
      }
    };
  });

  // The registration: the Trigger is the control, under the id the Field's label points at, and the
  // files are the value a Form's `onFormSubmit` receives.
  useRegisterFieldControl(trigger, controlId ?? undefined, files, undefined, enabled, options.name);

  useLayoutEffect(() => {
    setFilled(files.length > 0);
  }, [files, setFilled]);

  // A parent that rebuilds an equal list on each render changes nothing.
  const initialValue: unknown = field.validityData.initialValue;
  useValueChanged(files, (previous) => {
    if (!inField || sameFiles(previous, files)) {
      return;
    }
    clearErrors(name);
    setDirty(!(Array.isArray(initialValue) && sameFiles(initialValue, files)));
    validation.change(files);
  });

  // `commit` is stable per Field, while `validation` changes with every validity and message change,
  // which would hand the FileUpload context a new callback each time.
  const { commit } = validation;
  const triggerLeft = useCallback(() => {
    if (!inField) {
      return;
    }
    setTouched(true);
    if (validationMode === "onBlur") {
      void commit(files);
    }
  }, [inField, files, commit, validationMode, setTouched]);
  return { inField, triggerLeft };
}

/** What a Trigger's Field focus reads. */
export type FileUploadTriggerFocusOptions = {
  /** Whether the Trigger is disabled. A disabled Trigger never marks the Field focused. */
  readonly disabled: boolean;
  /** The Trigger's element, once mounted. */
  readonly trigger: Element | null;
  /** Called once focus has left the Trigger. */
  readonly left: () => void;
};

/** The focus handlers a Trigger spreads. */
export type FileUploadTriggerFocus = {
  /** Focus entered the Trigger. */
  readonly onFocus: () => void;
  /** Focus left the Trigger, or only the window did. */
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
};

/**
 * Keeps a surrounding Field's focused state for one Trigger, as Base UI's `useSetFieldFocused`
 * keeps it for its controls, which it does not export. Disabling or unmounting a focused Trigger
 * moves focus away without a `blur`, so the Trigger releases the Field's focused state then too. A
 * FileUpload may hold several Triggers, so a Trigger releases it only while it owns it.
 *
 * @param options - What the focus reads.
 * @returns The Trigger's focus handlers.
 */
export function useFileUploadTriggerFocus(options: FileUploadTriggerFocusOptions): FileUploadTriggerFocus {
  const { disabled, trigger, left } = options;
  const { setValidityData, setFocused, focusOwnerRef } = useFieldRootContext();
  const inField = setValidityData !== NOOP;
  // This Trigger's identity in the Field's `focusOwnerRef`, which Base UI's controls share.
  const [owner] = useState(() => Symbol("FileUpload.Trigger"));
  const setFieldFocused = useCallback(
    (focused: boolean) => {
      if (inField && (focused ? !disabled : focusOwnerRef.current === owner)) {
        focusOwnerRef.current = focused ? owner : false;
        setFocused(focused);
      }
    },
    [inField, disabled, focusOwnerRef, owner, setFocused]
  );

  // Re-run on `disabled`, so a focused Trigger that turns disabled releases the Field, and claim a
  // focus no event reported, as an `aria-disabled` Trigger re-enabled while it kept focus.
  useLayoutEffect(() => {
    if (trigger !== null && hasFocus(trigger)) {
      setFieldFocused(true);
    }
    return () => setFieldFocused(false);
  }, [trigger, setFieldFocused]);

  return {
    onFocus: () => setFieldFocused(true),
    onBlur: (event) => {
      // A Trigger inside a shadow root is read from that root: the document names only its host.
      if (hasFocus(event.currentTarget)) {
        return;
      }
      setFieldFocused(false);
      left();
    },
  };
}
