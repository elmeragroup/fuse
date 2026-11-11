import { AsYouType } from "libphonenumber-js/core";
import { afterEach, beforeEach } from "vitest";

/**
 * Drivers the phone editor's unit suites share. They are written against the editor's module
 * shape, so the live editor and the frozen base editor in `test/phone-base` take the same
 * fills and echoes.
 */

/** One change to the input's text, in the shape both editors' `edit` takes. */
type FixtureEdit = {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly selectionDirection: "none";
  readonly inputType: string;
};

/** The parts of an editor module the drivers use. */
type PhoneEditorModule<State, Props> = {
  readonly edit: (state: State, change: FixtureEdit) => State;
  readonly reconcile: (state: State, props: Props) => State;
  readonly proposedValue: (state: State) => string | null;
  readonly view: (state: State) => {
    readonly displayValue: string;
    readonly outputValue: string;
    readonly country: { readonly code: string };
  };
};

/** The drivers {@link phoneEditorFixtures} returns for one editor module. */
export type PhoneEditorFixtures<State, Props> = {
  /** Replaces the whole input, as a fill or autofill does, with the caret at its end. */
  readonly fill: (state: State, value: string) => State;
  /** What a test reads back: the display, the output and the country code. */
  readonly shown: (state: State) => { display: string; output: string; country: string };
  /** The output a proposing transition sends `onChange`, or null. */
  readonly proposedValue: (state: State) => string | null;
  /**
   * A controlled parent that takes every proposal back as its `value`, beside `props`. A proposal
   * that repeats the parent's value calls nothing, so the parent keeps that value, which the state
   * already shows.
   */
  readonly echo: (state: State, props: Props) => State;
};

/**
 * The shared drivers for one editor module.
 *
 * @template State - The editor's state.
 * @template Props - The editor's props.
 * @param editor - The live editor or the frozen base editor.
 * @returns Its fill, shown, proposedValue and echo drivers.
 */
export function phoneEditorFixtures<State, Props extends { readonly value?: string }>(
  editor: PhoneEditorModule<State, Props>
): PhoneEditorFixtures<State, Props> {
  const fill = (state: State, value: string) =>
    editor.edit(state, {
      value,
      selectionStart: value.length,
      selectionEnd: value.length,
      selectionDirection: "none",
      inputType: "insertText",
    });
  const shown = (state: State) => {
    const { displayValue, outputValue, country } = editor.view(state);
    return { display: displayValue, output: outputValue, country: country.code };
  };
  const echo = (state: State, props: Props) => {
    const value = editor.proposedValue(state) ?? editor.view(state).outputValue;
    return editor.reconcile(state, { ...props, value });
  };
  return { fill, shown, proposedValue: editor.proposedValue, echo };
}

/** A count of real libphonenumber parses. */
export type ParseCounter = {
  /** The parses since the test started or the last {@link ParseCounter.reset}. */
  readonly count: number;
  /** Starts the count again from zero. */
  readonly reset: () => void;
};

/**
 * Counts real libphonenumber parses in every test of the calling scope: `AsYouType#input` runs
 * once per parse, and patching the shared prototype counts them without mocking the module. Call
 * it in a file or `describe` body; it installs the patch before each test and restores it after.
 *
 * @returns The counter, reset before each test.
 */
export function parseCounter(): ParseCounter {
  // SAFETY: `input` is `AsYouType`'s own prototype method, read through its descriptor so the
  // reference stays unbound and `.call` below restores the instance.
  const realInput = Object.getOwnPropertyDescriptor(AsYouType.prototype, "input")?.value as (
    this: AsYouType,
    text: string
  ) => string;
  let parses = 0;
  beforeEach(() => {
    parses = 0;
    AsYouType.prototype.input = function countingInput(this: AsYouType, text: string) {
      parses += 1;
      return realInput.call(this, text);
    };
  });
  afterEach(() => {
    AsYouType.prototype.input = realInput;
  });
  return {
    get count() {
      return parses;
    },
    reset: () => {
      parses = 0;
    },
  };
}
