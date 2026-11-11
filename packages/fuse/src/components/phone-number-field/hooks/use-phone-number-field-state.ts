"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { CountryCode } from "libphonenumber-js/core";

import { hasFocus } from "../../../internal/active-element";
import { committedCountry, publishedCountry, startCountryNotices } from "../phone-country-notices";
import type { CountryNotices } from "../phone-country-notices";
import * as PhoneEditor from "../phone-editor";
import type {
  PhoneEdit,
  PhoneEditorProps,
  PhoneEditorState,
  PhoneEditorView,
  PhoneSelection,
} from "../phone-editor";
import type { PhoneNumberCountry } from "../phone-engine";

/** The editor's props, the field's two callbacks and the number input it restores the caret in. */
export type UsePhoneNumberFieldStateOptions = PhoneEditorProps & {
  /** Receives a proposal's output value when it differs from the value the parent holds. */
  onChange?: (value: string) => void;
  /**
   * Receives the country after a commit that changed it. With a controlled `countryCode`,
   * receives instead a proposed country, or the shown one, that differs from `countryCode`, once
   * per disagreement. A proposal that moves the country calls it before `onChange`.
   */
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
  const { displayValue, outputValue, country, countries, selection } = PhoneEditor.view(state);

  // `onCountryChange` follows the country notices: committed country changes without a
  // controlled country, and with one each disagreement once, proposed or shown.
  const countryNotices = useRef<CountryNotices | null>(null);
  countryNotices.current ??= startCountryNotices(PhoneEditor.observeCountry(state));
  useEffect(() => {
    if (!countryNotices.current) return;
    const committed = committedCountry(countryNotices.current, PhoneEditor.observeCountry(state));
    countryNotices.current = committed.notices;
    if (committed.country) onCountryChange?.(committed.country);
  });

  // `onChange` has one owner. The editor gives each value notice an identity: one per user
  // proposal, which `publish` delivers, and one per props change that proposes another output,
  // as a `countryCode` change that clears the digits, which the commit delivers. Each reaches
  // `onChange` once, whichever path sees it first and whatever order the parent answers in.
  // A parent can change its value inside `onCountryChange`, committing synchronously before the
  // proposal's `onChange` runs; a notice of the value it then holds tells it nothing. The ref
  // follows the committed `value`, which `flushSync` commits, layout effects included, before
  // it returns.
  const heldValue = useRef(props.value);
  useLayoutEffect(() => {
    heldValue.current = props.value;
  });
  const deliveredValues = useRef(new WeakSet<PhoneEditor.ValueNotice>());
  const deliverValue = (notice: PhoneEditor.ValueNotice | null) => {
    if (!notice || deliveredValues.current.has(notice)) return;
    deliveredValues.current.add(notice);
    if (heldValue.current !== undefined && notice.value === heldValue.current) return;
    onChange?.(notice.value);
  };
  const steered = PhoneEditor.steeredValue(state);
  useEffect(() => {
    deliverValue(steered);
  });

  // An edit whose display the editor rewrites, as formatOnType does, would leave the caret at
  // the end once React assigns the value. The commit after the edit puts back the caret the
  // edit's proposal carries, if the parent's first answer shows the proposed display, whatever
  // value it stores. Any other answer drops the caret. The editor keeps one caret per edit, as
  // one `selection` object, while the field shows its display, and drops it for good
  // otherwise; a new edit makes a new object even when it proposes the display already shown.
  // Dependencies alone cannot make this run once per edit, since React runs layout effects
  // again, unchanged, when a Suspense or Activity boundary reveals the field. So the effect
  // remembers the object it handled, which can only be the latest, and no later commit puts
  // the caret back.
  const handledSelection = useRef<PhoneSelection | null>(null);
  useLayoutEffect(() => {
    if (!selection || selection === handledSelection.current) {
      return;
    }
    handledSelection.current = selection;
    const input = inputRef.current;
    if (!input || input.value !== displayValue || !hasFocus(input)) {
      return;
    }
    input.setSelectionRange(selection.start, selection.end, selection.direction ?? undefined);
  }, [selection, displayValue, inputRef]);

  // The state updates even when the proposal has no notice, so a proposal that keeps the output
  // still re-formats the display and puts its caret back.
  // The notices take the proposal in before any callback runs: a parent that commits
  // synchronously inside one, through `flushSync`, would otherwise move them past it and the
  // proposal's country would be lost as out of date. `onCountryChange` then runs before
  // `onChange`, so a parent that takes the country at once reads the value in it, rather than
  // in the old country, where a later change of `countryCode` would clear it.
  const publish = (next: PhoneEditorState) => {
    if (next === state) return;
    setState(next);
    const published = countryNotices.current
      ? publishedCountry(countryNotices.current, PhoneEditor.observeCountry(next))
      : null;
    if (published) countryNotices.current = published.notices;
    if (published?.country) onCountryChange?.(published.country);
    deliverValue(PhoneEditor.proposalNotice(next));
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
