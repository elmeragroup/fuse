"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { CountryCode } from "libphonenumber-js/core";

import * as PhoneEditor from "../phone-editor";
import type { PhoneEdit, PhoneEditorProps, PhoneEditorState, PhoneEditorView } from "../phone-editor";
import type { PhoneNumberCountry } from "../phone-engine";

/** The editor's props, the field's two callbacks and the number input it restores the caret in. */
export type UsePhoneNumberFieldStateOptions = PhoneEditorProps & {
  /** Receives each proposal's output value. */
  onChange?: (value: string) => void;
  /** Receives the country after a commit that changed it. */
  onCountryChange?: (country: PhoneNumberCountry) => void;
  /** The number input, whose caret an edit's proposal puts back. */
  inputRef: RefObject<HTMLInputElement | null>;
};

/** What the field renders, and the handlers that propose changes to it. */
export type UsePhoneNumberFieldStateReturn = Pick<
  PhoneEditorView,
  "displayValue" | "outputValue" | "country" | "countries"
> & {
  /** Proposes a change to the input's text, read from the input after the browser applied it. */
  edit: (change: PhoneEdit) => void;
  /** Proposes pasted text in place of the number. */
  paste: (text: string) => void;
  /** Proposes a picked country. */
  selectCountry: (code: CountryCode | undefined) => void;
  /**
   * Native form-reset handler: restores `defaultValue`, or clears the digits in the visible
   * country without one; null when the parent owns `value`.
   */
  onReset: (() => void) | null;
};

/**
 * React adapter for the phone editor: holds its state, folds props in during render, sends
 * `onChange` and `onCountryChange`, and puts an edit's caret back.
 */
export function usePhoneNumberFieldState({
  onChange,
  onCountryChange,
  inputRef,
  ...props
}: UsePhoneNumberFieldStateOptions): UsePhoneNumberFieldStateReturn {
  const [stored, setState] = useState(() => PhoneEditor.create(props));

  // Props are folded in during render so external replacement is visible in the same
  // pass, including server rendering. The store catches up on commit.
  const state = PhoneEditor.reconcile(stored, props);
  if (state !== stored) setState(state);
  const { displayValue, outputValue, country, countries, selection, proposalKey } = PhoneEditor.view(state);

  // Notify only committed country changes, including external value/catalog replacement and
  // a reset that restores a default in another country. A reset without a default keeps the
  // visible country, so it stays silent.
  const notifiedCountry = useRef(country.code);
  useEffect(() => {
    if (notifiedCountry.current !== country.code) {
      notifiedCountry.current = country.code;
      onCountryChange?.(country);
    }
  }, [country, onCountryChange]);

  // An edit whose display the editor rewrites, as formatOnType does, would leave the caret at
  // the end once React assigns the value. The commit after the edit puts back the caret the
  // edit's proposal carries, if the parent's first answer shows the proposed display, whatever
  // value it stores. Any other answer drops the caret. This runs after every commit: deleting a
  // separator proposes the display that was already shown, so no dependency changes.
  const pendingCaretRef = useRef<object | null>(null);
  useLayoutEffect(() => {
    const pending = pendingCaretRef.current;
    pendingCaretRef.current = null;
    const input = inputRef.current;
    if (!pending || pending !== proposalKey || !selection || !input || input.value !== displayValue) {
      return;
    }
    // The document's activeElement is the shadow host for an input in a shadow root.
    const root = input.getRootNode();
    const focused = root instanceof Document || root instanceof ShadowRoot ? root.activeElement : null;
    if (focused !== input) {
      return;
    }
    input.setSelectionRange(selection.start, selection.end, selection.direction ?? undefined);
  });

  const publish = (next: PhoneEditorState) => {
    if (next === state) return;
    const proposed = PhoneEditor.view(next);
    // Recorded before the proposal is published, since a parent that accepts it
    // synchronously commits the new display before `onChange` returns.
    pendingCaretRef.current = proposed.proposalKey;
    setState(next);
    onChange?.(proposed.outputValue);
  };

  return {
    displayValue,
    outputValue,
    country,
    countries,
    edit: (change) => publish(PhoneEditor.edit(state, change)),
    paste: (text) => publish(PhoneEditor.paste(state, text)),
    selectCountry: (code) => publish(PhoneEditor.selectCountry(state, code)),
    // Reset only when this hook owns the value. A parent-owned `value` is the parent's
    // to keep; a reset handler on this side would fight it.
    onReset: props.value === undefined ? () => setState(PhoneEditor.reset) : null,
  };
}
