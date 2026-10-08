import { AsYouType } from "libphonenumber-js/core";
import type { MetadataJson } from "libphonenumber-js/core";
import defaultMetadata from "libphonenumber-js/metadata.min.json";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { EMPTY_PICKER_ERROR_MESSAGE } from "../../../test/phone-picker-contract";
import * as PhoneEditor from "./phone-editor";
import type { PhoneEditorProps, PhoneEditorState } from "./phone-editor";
import type { PhoneNumberCountry } from "./phone-engine";

const swedishMetadata: MetadataJson = {
  ...defaultMetadata,
  countries: { SE: defaultMetadata.countries.SE },
  country_calling_codes: { "46": ["SE"] },
};

/** What a test reads back: the display, the output and the country code. */
function shown(state: PhoneEditorState) {
  const { displayValue, outputValue, country } = PhoneEditor.view(state);
  return { display: displayValue, output: outputValue, country: country.code };
}

/** Replaces the whole input, as a fill or autofill does, with the caret at its end. */
function fill(state: PhoneEditorState, value: string): PhoneEditorState {
  return PhoneEditor.edit(state, {
    value,
    selectionStart: value.length,
    selectionEnd: value.length,
    selectionDirection: "none",
    inputType: "insertText",
  });
}

/**
 * The value and caret a browser hands the change handler after one key at `caret`: a
 * character to insert, or `Backspace` or `Delete`.
 */
function keyAt(state: PhoneEditorState, caret: number, key: string): PhoneEditorState {
  const display = PhoneEditor.view(state).displayValue;
  if (key === "Backspace") {
    const value = display.slice(0, caret - 1) + display.slice(caret);
    return PhoneEditor.edit(state, {
      value,
      selectionStart: caret - 1,
      selectionEnd: caret - 1,
      selectionDirection: "none",
      inputType: "deleteContentBackward",
    });
  }
  if (key === "Delete") {
    const value = display.slice(0, caret) + display.slice(caret + 1);
    return PhoneEditor.edit(state, {
      value,
      selectionStart: caret,
      selectionEnd: caret,
      selectionDirection: "none",
      inputType: "deleteContentForward",
    });
  }
  const value = display.slice(0, caret) + key + display.slice(caret);
  return PhoneEditor.edit(state, {
    value,
    selectionStart: caret + 1,
    selectionEnd: caret + 1,
    selectionDirection: "none",
    inputType: "insertText",
  });
}

/** A controlled parent that takes every proposal back as its `value`. */
function echo(state: PhoneEditorState, props: PhoneEditorProps = {}): PhoneEditorState {
  return PhoneEditor.reconcile(state, { ...props, value: PhoneEditor.view(state).outputValue });
}

/** Where the caret sits after an edit: the editor's selection, else where the browser left it. */
function caretAfter(state: PhoneEditorState, fallback: number): number {
  return PhoneEditor.view(state).selection?.start ?? fallback;
}

describe("PhoneEditor.create", () => {
  it("reads a controlled value, then a default, in the default country", () => {
    expect(shown(PhoneEditor.create({ value: "+46701234567" }))).toEqual({
      display: "701234567",
      output: "+46701234567",
      country: "SE",
    });
    expect(shown(PhoneEditor.create({ defaultValue: "+4741234567" }))).toEqual({
      display: "41234567",
      output: "+4741234567",
      country: "NO",
    });
    expect(shown(PhoneEditor.create({ defaultCountryCode: "FI" }))).toEqual({
      display: "",
      output: "",
      country: "FI",
    });
  });

  it("lets a controlled value win over the default, even when empty", () => {
    expect(shown(PhoneEditor.create({ value: "", defaultValue: "+4741234567" }))).toEqual({
      display: "",
      output: "",
      country: "NO",
    });
  });

  it.each([
    ["+24712345", "+24712345", "NO"],
    ["+79123456789", "+79123456789", "NO"],
    ["+46701234567", "701234567", "SE"],
  ] as const)(
    "keeps the international identity of %s, as a value and as a paste",
    (value, display, country) => {
      expect(shown(PhoneEditor.create({ value }))).toEqual({ display, output: value, country });
      expect(shown(PhoneEditor.paste(PhoneEditor.create({}), value))).toEqual({
        display,
        output: value,
        country,
      });
    }
  );

  it("throws when the countries leave no picker country", () => {
    expect(() => PhoneEditor.create({ countries: [] })).toThrow(EMPTY_PICKER_ERROR_MESSAGE);
    const state = PhoneEditor.create({ countries: ["NO"] });
    expect(() => PhoneEditor.reconcile(state, { countries: [] })).toThrow(EMPTY_PICKER_ERROR_MESSAGE);
  });
});

describe("PhoneEditor.edit and paste", () => {
  it("auto-detects SE from +46 and strips the prefix in national mode", () => {
    expect(shown(fill(PhoneEditor.create({}), "+46701234567"))).toEqual({
      display: "701234567",
      output: "+46701234567",
      country: "SE",
    });
  });

  it("strips non-phone characters from an edit and a paste", () => {
    const expected = { display: "41234567", output: "+4741234567", country: "NO" };
    expect(shown(fill(PhoneEditor.create({}), "41234567abc"))).toEqual(expected);
    expect(shown(PhoneEditor.paste(PhoneEditor.create({}), "412-34-567abc"))).toEqual(expected);
  });

  it.each([
    { copied: " +46 701 234 567", formatOnType: false, display: "701234567" },
    { copied: " +46 701 234 567", formatOnType: true, display: "070-123 45 67" },
    { copied: "(+46) 70 123 45 67", formatOnType: false, display: "701234567" },
    { copied: "(+46) 70 123 45 67", formatOnType: true, display: "070-123 45 67" },
  ])(
    "detects a pasted '$copied' from Norway, formatOnType $formatOnType",
    ({ copied, formatOnType, display }) => {
      const state = PhoneEditor.create({ formatOnType });
      expect(shown(state).country).toBe("NO");
      expect(shown(PhoneEditor.paste(state, copied))).toEqual({
        display,
        output: "+46701234567",
        country: "SE",
      });
    }
  );

  it("keeps a pasted number from an unlisted country international", () => {
    expect(shown(PhoneEditor.paste(PhoneEditor.create({ countries: ["NO"] }), "+46701234567"))).toEqual({
      display: "+46701234567",
      output: "+46701234567",
      country: "NO",
    });
  });

  it.each([
    { formatOnType: false, completed: "2642351234" },
    { formatOnType: true, completed: "(264) 235-1234" },
  ])(
    "completes a pasted partial international number without repeating its area code, formatOnType $formatOnType",
    ({ formatOnType, completed }) => {
      let state = PhoneEditor.paste(PhoneEditor.create({ formatOnType }), "+12642351");
      expect(shown(state)).toEqual({ display: "2642351", output: "+12642351", country: "AI" });
      let caret = 7;
      for (const key of "234") {
        state = keyAt(state, caret, key);
        caret = caretAfter(state, caret + 1);
      }
      expect(shown(state)).toEqual({ display: completed, output: "+12642351234", country: "AI" });
    }
  );

  describe("national trunk prefix", () => {
    // The issue's per-key expectations for a Swedish mobile number typed with its trunk 0.
    const asTyped = [
      "0",
      "07",
      "070",
      "0701",
      "07012",
      "070123",
      "0701234",
      "07012345",
      "070123456",
      "0701234567",
    ];
    const formattedAsTyped = [
      "0",
      "07",
      "070",
      "070-1",
      "070-12",
      "070-123",
      "070-123 4",
      "070-123 45",
      "070-123 45 6",
      "070-123 45 67",
    ];

    it.each([
      { mode: "uncontrolled", controlled: false, formatOnType: false, expected: asTyped },
      { mode: "uncontrolled", controlled: false, formatOnType: true, expected: formattedAsTyped },
      { mode: "controlled", controlled: true, formatOnType: false, expected: asTyped },
      { mode: "controlled", controlled: true, formatOnType: true, expected: formattedAsTyped },
    ])(
      "keeps the trunk 0 on display key by key, $mode, formatOnType $formatOnType",
      ({ controlled, formatOnType, expected }) => {
        const props = { defaultCountryCode: "SE", formatOnType } as const;
        let state = PhoneEditor.create(controlled ? { ...props, value: "" } : props);
        const displays: string[] = [];
        for (const key of "0701234567") {
          state = keyAt(state, PhoneEditor.view(state).displayValue.length, key);
          if (controlled) state = echo(state, props);
          displays.push(PhoneEditor.view(state).displayValue);
        }
        expect(displays).toEqual(expected);
        expect(PhoneEditor.view(state).outputValue).toBe("+46701234567");
      }
    );

    it("strips separators from a filled national number but keeps its trunk 0", () => {
      expect(shown(fill(PhoneEditor.create({ defaultCountryCode: "SE" }), "070 123 45 67"))).toEqual({
        display: "0701234567",
        output: "+46701234567",
        country: "SE",
      });
    });
  });
});

describe("PhoneEditor caret", () => {
  /** A focused Norwegian number shown as "91 23 45 67" under `formatOnType`. */
  function formatted(props: PhoneEditorProps = {}) {
    return PhoneEditor.create({ defaultValue: "+4791234567", formatOnType: true, ...props });
  }

  it("keeps the caret after the previous digit through typing and Backspace", () => {
    let state = formatted();
    expect(PhoneEditor.view(state).displayValue).toBe("91 23 45 67");
    // Backspace after the 2 deletes it, and the caret stays after "91".
    state = keyAt(state, 4, "Backspace");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "91 34 56 7",
      selection: { start: 2, end: 2, direction: "none" },
    });
    state = keyAt(state, 2, "5");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "91 53 45 67",
      outputValue: "+4791534567",
      selection: { start: 4, end: 4, direction: "none" },
    });
    // Backspace after a space deletes only the space, which comes back.
    state = keyAt(state, 3, "Backspace");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "91 53 45 67",
      selection: { start: 2, end: 2, direction: "none" },
    });
    state = keyAt(state, 2, "0");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "910534567",
      outputValue: "+47910534567",
      selection: { start: 3, end: 3, direction: "none" },
    });
  });

  it("keeps the caret before the next digit through forward deletes", () => {
    // Delete after the space removes the 2, and the caret waits before the 3.
    let state = keyAt(formatted(), 3, "Delete");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "91 34 56 7",
      selection: { start: 3, end: 3, direction: "none" },
    });
    state = keyAt(state, 3, "Delete");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "91 45 67",
      selection: { start: 3, end: 3, direction: "none" },
    });
    // Delete before a space removes only the space, which comes back; the caret lands past it,
    // so the next Delete reaches the digit after it.
    state = keyAt(state, 2, "Delete");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "91 45 67",
      selection: { start: 3, end: 3, direction: "none" },
    });
    state = keyAt(state, 3, "Delete");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "91 56 7",
      outputValue: "+4791567",
    });
  });

  it.each(["deleteWordForward", "deleteSoftLineForward", "deleteHardLineForward", "deleteByCut"])(
    "puts the caret before the next digit for %s",
    (inputType) => {
      const state = PhoneEditor.edit(formatted(), {
        value: "91 3 45 67",
        selectionStart: 3,
        selectionEnd: 3,
        selectionDirection: "none",
        inputType,
      });
      expect(PhoneEditor.view(state).selection).toEqual({ start: 3, end: 3, direction: "none" });
    }
  );

  it("keeps the caret after the calling code an international display adds", () => {
    let state = PhoneEditor.create({ international: true, formatOnType: true });
    state = keyAt(state, 0, "9");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "+47 9",
      selection: { start: 5, end: 5, direction: "none" },
    });
    state = fill(state, "+47 91 23 45 67");
    expect(PhoneEditor.view(state).displayValue).toBe("+47 91 23 45 67");
    state = keyAt(state, 8, "Backspace");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "+47 9134567",
      selection: { start: 6, end: 6, direction: "none" },
    });
    state = keyAt(state, 6, "5");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "+47 91 53 45 67",
      outputValue: "+4791534567",
      selection: { start: 8, end: 8, direction: "none" },
    });
  });

  it("keeps each end of a selection and its direction", () => {
    const state = PhoneEditor.edit(PhoneEditor.create({ formatOnType: true }), {
      value: "91234567",
      selectionStart: 0,
      selectionEnd: 2,
      selectionDirection: "backward",
      inputType: "insertFromPaste",
    });
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "91 23 45 67",
      selection: { start: 0, end: 2, direction: "backward" },
    });
  });

  it("puts the caret at the start when more digits follow it than the display keeps", () => {
    const state = PhoneEditor.edit(PhoneEditor.create({}), {
      value: "004791",
      selectionStart: 0,
      selectionEnd: 0,
      selectionDirection: "none",
      inputType: "insertText",
    });
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "91",
      selection: { start: 0, end: 0, direction: "none" },
    });
  });

  it("keeps the caret where a separator typed into an unformatted number was dropped", () => {
    let state = fill(PhoneEditor.create({}), "41234567");
    state = keyAt(state, 2, "-");
    expect(PhoneEditor.view(state)).toMatchObject({
      displayValue: "41234567",
      selection: { start: 2, end: 2, direction: "none" },
    });
  });

  it("stores no caret when the display is what was typed, or the input reports no selection", () => {
    const typed = fill(PhoneEditor.create({}), "4");
    expect(PhoneEditor.view(typed)).toMatchObject({ displayValue: "4", selection: null, proposalKey: null });
    const unknown = PhoneEditor.edit(formatted(), {
      value: "91 3 45 67",
      selectionStart: null,
      selectionEnd: null,
      selectionDirection: null,
      inputType: null,
    });
    expect(PhoneEditor.view(unknown)).toMatchObject({
      displayValue: "91 34 56 7",
      selection: null,
      proposalKey: null,
    });
  });

  it("gives each proposal its own key, even one that proposes the display already shown", () => {
    const first = keyAt(formatted(), 3, "Backspace");
    const second = keyAt(first, 3, "Backspace");
    expect(PhoneEditor.view(first).displayValue).toBe("91 23 45 67");
    expect(PhoneEditor.view(second).displayValue).toBe("91 23 45 67");
    expect(PhoneEditor.view(first).proposalKey).not.toBeNull();
    expect(PhoneEditor.view(second).proposalKey).not.toBeNull();
    expect(PhoneEditor.view(second).proposalKey).not.toBe(PhoneEditor.view(first).proposalKey);
  });

  describe("under a controlled value", () => {
    const props = { value: "+4791234567", formatOnType: true } as const;

    function backspaced() {
      return keyAt(PhoneEditor.create(props), 4, "Backspace");
    }

    it("shows the proposal and its caret until the parent answers", () => {
      expect(PhoneEditor.view(backspaced())).toMatchObject({
        displayValue: "91 34 56 7",
        outputValue: "+479134567",
        selection: { start: 2, end: 2, direction: "none" },
      });
    });

    it("keeps the caret of a proposal the parent echoes", () => {
      const proposed = backspaced();
      const echoed = PhoneEditor.reconcile(proposed, { ...props, value: "+479134567" });
      expect(PhoneEditor.view(echoed)).toMatchObject({
        displayValue: "91 34 56 7",
        outputValue: "+479134567",
        selection: { start: 2, end: 2, direction: "none" },
      });
      expect(PhoneEditor.view(echoed).proposalKey).toBe(PhoneEditor.view(proposed).proposalKey);
    });

    it("drops the caret with a proposal the parent rejects", () => {
      const rejected = PhoneEditor.reconcile(backspaced(), props);
      expect(PhoneEditor.view(rejected)).toMatchObject({
        displayValue: "91 23 45 67",
        outputValue: "+4791234567",
        selection: null,
        proposalKey: null,
      });
    });

    it("keeps the caret when the parent stores its own form of the proposed number", () => {
      const proposed = backspaced();
      const stored = PhoneEditor.reconcile(proposed, { ...props, value: "9134567" });
      expect(PhoneEditor.view(stored)).toMatchObject({
        displayValue: "91 34 56 7",
        outputValue: "+479134567",
        selection: { start: 2, end: 2, direction: "none" },
      });
      expect(PhoneEditor.view(stored).proposalKey).toBe(PhoneEditor.view(proposed).proposalKey);
      const later = PhoneEditor.reconcile(stored, { ...props, value: "9134567" });
      expect(later).toBe(stored);
      expect(PhoneEditor.view(later).proposalKey).toBe(PhoneEditor.view(proposed).proposalKey);
    });

    it("keeps the caret when the parent keeps its own form of a number the edit shows unchanged", () => {
      const national = { value: "91234567", formatOnType: true } as const;
      // Backspace after the space in "91 23 45 67" removes only the space, which formatting
      // puts back.
      const proposed = keyAt(PhoneEditor.create(national), 3, "Backspace");
      const kept = PhoneEditor.reconcile(proposed, national);
      expect(PhoneEditor.view(kept)).toMatchObject({
        displayValue: "91 23 45 67",
        outputValue: "+4791234567",
        selection: { start: 2, end: 2, direction: "none" },
      });
      expect(PhoneEditor.view(kept).proposalKey).toBe(PhoneEditor.view(proposed).proposalKey);
    });

    it("drops the caret with a proposal the parent replaces", () => {
      const replaced = PhoneEditor.reconcile(backspaced(), { ...props, value: "+4799999999" });
      expect(PhoneEditor.view(replaced)).toMatchObject({
        displayValue: "99 99 99 99",
        outputValue: "+4799999999",
        selection: null,
      });
    });

    it("shows the accepted proposal's key, not the rejected one's", () => {
      const accepted = PhoneEditor.reconcile(backspaced(), { ...props, value: "+479134567" });
      const acceptedKey = PhoneEditor.view(accepted).proposalKey;
      const proposed = keyAt(accepted, 2, "5");
      const rejected = PhoneEditor.reconcile(proposed, { ...props, value: "+479134567" });
      expect(PhoneEditor.view(rejected).displayValue).toBe("91 34 56 7");
      expect(PhoneEditor.view(rejected).proposalKey).toBe(acceptedKey);
      expect(PhoneEditor.view(rejected).proposalKey).not.toBe(PhoneEditor.view(proposed).proposalKey);
    });

    it("leaves the caret alone when a rejected proposal comes back through a delayed echo", () => {
      const rejected = PhoneEditor.reconcile(backspaced(), props);
      const echoed = PhoneEditor.reconcile(rejected, { ...props, value: "+479134567" });
      expect(PhoneEditor.view(echoed)).toMatchObject({
        displayValue: "91 34 56 7",
        outputValue: "+479134567",
        selection: null,
        proposalKey: null,
      });
    });

    it("keeps the caret of an echo that a configuration change re-derives to the same display", () => {
      const proposed = backspaced();
      const echoed = PhoneEditor.reconcile(proposed, {
        ...props,
        value: "+479134567",
        autoDetectCountry: false,
      });
      expect(PhoneEditor.view(echoed)).toMatchObject({
        displayValue: "91 34 56 7",
        selection: { start: 2, end: 2, direction: "none" },
      });
      expect(PhoneEditor.view(echoed).proposalKey).toBe(PhoneEditor.view(proposed).proposalKey);
    });

    it("drops the caret of an echo that a configuration change shows differently", () => {
      const echoed = PhoneEditor.reconcile(backspaced(), { value: "+479134567", formatOnType: false });
      expect(PhoneEditor.view(echoed)).toMatchObject({
        displayValue: "9134567",
        selection: null,
        proposalKey: null,
      });
    });
  });
});

describe("PhoneEditor.selectCountry", () => {
  it("clears the digits by default", () => {
    const state = fill(PhoneEditor.create({}), "41234567");
    expect(shown(PhoneEditor.selectCountry(state, "SE"))).toEqual({ display: "", output: "", country: "SE" });
  });

  it("keeps the national format of a detected number through a preserving country change", () => {
    const pasted = PhoneEditor.paste(
      PhoneEditor.create({ formatOnType: true, preserveOnCountryChange: true }),
      "+46701234567"
    );
    expect(PhoneEditor.view(pasted).displayValue).toBe("070-123 45 67");
    expect(shown(PhoneEditor.selectCountry(pasted, "FI"))).toEqual({
      display: "070 1234567",
      output: "+358701234567",
      country: "FI",
    });
  });

  it("returns the same state for the shown country, no country or one the picker lacks", () => {
    const state = PhoneEditor.create({ countries: ["NO", "SE"] });
    expect(PhoneEditor.selectCountry(state, "NO")).toBe(state);
    expect(PhoneEditor.selectCountry(state, undefined)).toBe(state);
    expect(PhoneEditor.selectCountry(state, "FI")).toBe(state);
  });
});

describe("PhoneEditor.reconcile", () => {
  it("returns the same state for equal props in new objects", () => {
    const props = { value: "+4741234567", countries: ["NO", "SE"] } as const;
    const state = PhoneEditor.create(props);
    expect(PhoneEditor.reconcile(state, { ...props, countries: ["NO", "SE"] })).toBe(state);
  });

  it("hands out the picker rows read-only", () => {
    const { countries, country } = PhoneEditor.view(PhoneEditor.create({}));
    expectTypeOf(countries).toEqualTypeOf<ReadonlyArray<Readonly<PhoneNumberCountry>>>();
    expectTypeOf(country).toEqualTypeOf<Readonly<PhoneNumberCountry>>();
  });

  it("keeps the picker rows when only a display flag changes", () => {
    const state = PhoneEditor.create({ countries: ["NO", "SE"] });
    const next = PhoneEditor.reconcile(state, { countries: ["NO", "SE"], formatOnType: true });
    expect(PhoneEditor.view(next).countries).toBe(PhoneEditor.view(state).countries);
    expect(PhoneEditor.view(next).countries.map((row) => row.code)).toEqual(["NO", "SE"]);
  });

  it("reads an external replacement even when configuration changes in the same transition", () => {
    const proposed = fill(PhoneEditor.create({ value: "", international: true }), "41234567");
    const next = PhoneEditor.reconcile(proposed, {
      value: "+4799999999",
      international: true,
      autoDetectCountry: false,
    });
    expect(shown(next)).toEqual({ display: "+4799999999", output: "+4799999999", country: "NO" });
  });

  it("re-reads a replaced controlled value with the visible country", () => {
    const next = PhoneEditor.reconcile(PhoneEditor.create({ value: "" }), { value: "+46701234567" });
    expect(shown(next)).toEqual({ display: "701234567", output: "+46701234567", country: "SE" });
  });

  it("keeps national digits national when detection is off and display formatting toggles", () => {
    const typed = fill(PhoneEditor.create({ autoDetectCountry: false }), "41234567");
    const next = PhoneEditor.reconcile(typed, { autoDetectCountry: false, formatOnType: true });
    expect(shown(next)).toEqual({ display: "41 23 45 67", output: "+4741234567", country: "NO" });
  });

  it("keeps a typed international prefix through a formatting change", () => {
    const typed = fill(PhoneEditor.create({ international: true }), "+4741234567");
    const next = PhoneEditor.reconcile(typed, { international: true, outputFormat: "national" });
    expect(shown(next)).toEqual({ display: "+4741234567", output: "41 23 45 67", country: "NO" });
  });

  it("keeps an uncontrolled international draft when only the output format changes", () => {
    const typed = fill(PhoneEditor.create({ international: true }), "41234567");
    expect(PhoneEditor.view(typed).outputValue).toBe("+4741234567");
    const next = PhoneEditor.reconcile(typed, { international: true, outputFormat: "raw" });
    expect(shown(next)).toEqual({ display: "41234567", output: "41234567", country: "NO" });
  });

  it("keeps the national format of a detected number when formatOnType turns on", () => {
    const state = PhoneEditor.create({ defaultValue: "+46701234567" });
    expect(PhoneEditor.view(state).displayValue).toBe("701234567");
    const next = PhoneEditor.reconcile(state, { defaultValue: "+46701234567", formatOnType: true });
    expect(shown(next)).toEqual({ display: "070-123 45 67", output: "+46701234567", country: "SE" });
  });

  it.each([false, true])(
    "keeps accepted national digits when detection turns off, same answer: %s",
    (same) => {
      const props = { value: "", international: true } as const;
      const proposed = fill(PhoneEditor.create(props), "41234567");
      const off = { international: true, autoDetectCountry: false, value: "+4741234567" } as const;
      const next = same
        ? PhoneEditor.reconcile(proposed, off)
        : PhoneEditor.reconcile(echo(proposed, props), off);
      expect(shown(next)).toEqual({ display: "41234567", output: "+4741234567", country: "NO" });
    }
  );

  describe("controlled echo", () => {
    it.each([
      [
        "emits the national format without rewriting what was typed",
        { outputFormat: "national" },
        "41234567",
        "41 23 45 67",
        "41234567",
      ],
      [
        "shows what was entered in international mode and stores the full number",
        { international: true },
        "41234567",
        "+4741234567",
        "41234567",
      ],
      [
        "keeps a typed international prefix in international mode",
        { international: true },
        "+4741234567",
        "+4741234567",
        "+4741234567",
      ],
      [
        "formats as you type when formatOnType is set",
        { formatOnType: true },
        "41234567",
        "+4741234567",
        "41 23 45 67",
      ],
    ] as const)("%s", (_name, props, typed, output, display) => {
      const proposed = fill(PhoneEditor.create({ ...props, value: "" }), typed);
      expect(PhoneEditor.view(proposed).outputValue).toBe(output);
      expect(shown(echo(proposed, props))).toEqual({ display, output, country: "NO" });
    });

    it("keeps rejected proposals out of the display, then accepts a delayed echo", () => {
      const props = { international: true } as const;
      const state = PhoneEditor.create({ ...props, value: "+4741234567" });
      expect(shown(state)).toEqual({ display: "+4741234567", output: "+4741234567", country: "NO" });
      const proposed = fill(state, "99887766");
      expect(PhoneEditor.view(proposed).outputValue).toBe("+4799887766");
      const rejected = PhoneEditor.reconcile(proposed, { ...props, value: "+4741234567" });
      expect(shown(rejected)).toEqual({ display: "+4741234567", output: "+4741234567", country: "NO" });
      const accepted = PhoneEditor.reconcile(rejected, { ...props, value: "+4799887766" });
      expect(shown(accepted)).toEqual({ display: "99887766", output: "+4799887766", country: "NO" });
      const replaced = PhoneEditor.reconcile(accepted, { ...props, value: "+46701234567" });
      expect(shown(replaced)).toEqual({ display: "+46701234567", output: "+46701234567", country: "SE" });
      const cleared = PhoneEditor.reconcile(replaced, { ...props, value: "" });
      expect(PhoneEditor.view(cleared)).toMatchObject({ displayValue: "", outputValue: "" });
    });

    it("keeps the accepted country's number when the parent rejects a paste", () => {
      const props = { international: true } as const;
      const accepted = echo(fill(PhoneEditor.create({ ...props, value: "" }), "41234567"), props);
      expect(shown(accepted)).toEqual({ display: "41234567", output: "+4741234567", country: "NO" });
      const pasted = PhoneEditor.paste(accepted, "+46701234567");
      expect(PhoneEditor.view(pasted).outputValue).toBe("+46701234567");
      const rejected = PhoneEditor.reconcile(pasted, { ...props, value: "+4741234567" });
      expect(shown(rejected)).toEqual({ display: "41234567", output: "+4741234567", country: "NO" });
    });

    it("shows the digits again when the parent clears then restores the emitted value", () => {
      let state = PhoneEditor.create({ value: "" });
      for (const key of "41234567") {
        state = echo(keyAt(state, PhoneEditor.view(state).displayValue.length, key));
      }
      expect(shown(state)).toEqual({ display: "41234567", output: "+4741234567", country: "NO" });
      state = PhoneEditor.reconcile(state, { value: "" });
      expect(PhoneEditor.view(state).displayValue).toBe("");
      state = PhoneEditor.reconcile(state, { value: "+4741234567" });
      expect(shown(state)).toEqual({ display: "41234567", output: "+4741234567", country: "NO" });
    });
  });

  describe("catalog replacement", () => {
    it("preserves a controlled number when its country leaves the metadata", () => {
      const state = PhoneEditor.create({ value: "+4741234567" });
      const replaced = PhoneEditor.reconcile(state, { value: "+4741234567", metadata: swedishMetadata });
      expect(shown(replaced)).toEqual({ display: "+4741234567", output: "+4741234567", country: "SE" });
      expect(PhoneEditor.view(replaced).countries.map((row) => row.code)).toEqual(["SE"]);
      const typed = echo(fill(replaced, "701234567"), { metadata: swedishMetadata });
      expect(shown(typed)).toEqual({ display: "701234567", output: "+46701234567", country: "SE" });
    });

    it.each([
      { existing: false, display: "", output: "" },
      { existing: true, display: "+4741234567", output: "+4741234567" },
    ])("reconciles metadata with existing digits: $existing", ({ existing, display, output }) => {
      const state = PhoneEditor.create({});
      const before = existing ? fill(state, "41234567") : state;
      const replaced = PhoneEditor.reconcile(before, { metadata: swedishMetadata });
      expect(shown(replaced)).toEqual({ display, output, country: "SE" });
      expect(PhoneEditor.view(fill(replaced, "701234567")).outputValue).toBe("+46701234567");
    });

    it("re-reads authoritative controlled raw digits under a replaced catalog", () => {
      const state = PhoneEditor.create({ value: "41234567", outputFormat: "raw" });
      const next = PhoneEditor.reconcile(state, {
        value: "41234567",
        outputFormat: "raw",
        metadata: swedishMetadata,
      });
      expect(shown(next)).toEqual({ display: "41234567", output: "41234567", country: "SE" });
    });

    it.each([
      { mode: "uncontrolled", props: { defaultValue: "+46701234567" } },
      { mode: "controlled", props: { value: "+46701234567" } },
    ])("keeps a number's identity when the picker countries drop its country, $mode", ({ props }) => {
      const state = PhoneEditor.create({ ...props, countries: ["NO", "SE"] });
      expect(shown(state)).toEqual({ display: "701234567", output: "+46701234567", country: "SE" });
      const next = PhoneEditor.reconcile(state, { ...props, countries: ["NO"] });
      expect(shown(next)).toEqual({ display: "+46701234567", output: "+46701234567", country: "NO" });
    });

    it.each([
      ["gains", ["NO", "SE", "FI"]],
      ["loses", ["SE"]],
    ] as const)("keeps national drafts as typed when the picker %s other countries", (_change, after) => {
      const typed = fill(
        PhoneEditor.create({ countries: ["NO", "SE"], defaultCountryCode: "SE" }),
        "0701234567"
      );
      // A catalog replacement would re-read it through its E.164 form as "701234567".
      expect(shown(PhoneEditor.reconcile(typed, { countries: after, defaultCountryCode: "SE" }))).toEqual({
        display: "0701234567",
        output: "+46701234567",
        country: "SE",
      });
      // A controlled draft too short to submit: the parent holds "", and the draft stays shown.
      const props = { value: "", countries: ["NO", "SE"], defaultCountryCode: "SE" } as const;
      const draft = PhoneEditor.reconcile(fill(PhoneEditor.create(props), "0"), props);
      expect(PhoneEditor.view(draft)).toMatchObject({ displayValue: "0", outputValue: "" });
      const next = PhoneEditor.reconcile(draft, { ...props, countries: after });
      expect(PhoneEditor.view(next).displayValue).toBe("0");
    });

    it.each([
      // Anguilla dials seven-digit local numbers, which take its 264 area code.
      ["AI", "2351234", "+12642351234"],
      // Kazakhstan's trunk prefix is 8.
      ["KZ", "87011234567", "+77011234567"],
    ] as const)(
      "re-reads a %s draft by its own rules when its country leaves the picker",
      (code, digits, e164) => {
        const typed = fill(PhoneEditor.create({ countries: [code, "NO"], defaultCountryCode: code }), digits);
        expect(PhoneEditor.view(typed).outputValue).toBe(e164);
        const next = PhoneEditor.reconcile(typed, { countries: ["NO"], defaultCountryCode: code });
        expect(shown(next)).toEqual({ display: e164, output: e164, country: "NO" });
      }
    );

    it.each([
      // The national format names no country, but the number still yields the parent's value.
      ["national", "070-123 45 67", { display: "+46701234567", output: "070-123 45 67", country: "NO" }],
      // Raw digits name no country, so they read again as themselves in the one that remains.
      ["raw", "0701234567", { display: "0701234567", output: "0701234567", country: "NO" }],
    ] as const)(
      "keeps a controlled %s value the parent kept when its country leaves the picker",
      (outputFormat, value, expected) => {
        const props = { outputFormat, countries: ["SE", "NO"], defaultCountryCode: "SE" } as const;
        const proposed = fill(PhoneEditor.create({ ...props, value: "" }), "0701234567");
        const accepted = PhoneEditor.reconcile(proposed, { ...props, value });
        expect(PhoneEditor.view(accepted).outputValue).toBe(value);
        const next = PhoneEditor.reconcile(accepted, { ...props, value, countries: ["NO"] });
        expect(shown(next)).toEqual(expected);
      }
    );

    it.each([
      ["e164", "+46701234567"],
      ["international", "+46 70 123 45 67"],
      ["national", "070-123 45 67"],
    ] as const)(
      "keeps a controlled number the parent gave in another form when its country leaves the picker, %s",
      (outputFormat, submits) => {
        const props = { outputFormat, value: "0701234567", defaultCountryCode: "SE" } as const;
        const state = PhoneEditor.create({ ...props, countries: ["SE", "NO"] });
        expect(PhoneEditor.view(state).outputValue).toBe(submits);
        const next = PhoneEditor.reconcile(state, { ...props, countries: ["NO"] });
        expect(PhoneEditor.view(next).outputValue).toBe(submits);
      }
    );

    it("empties a draft that holds no number yet when its country leaves the picker", () => {
      const typed = fill(PhoneEditor.create({ countries: ["SE", "NO"], defaultCountryCode: "SE" }), "0");
      const next = PhoneEditor.reconcile(typed, { countries: ["NO"], defaultCountryCode: "SE" });
      expect(PhoneEditor.view(next)).toMatchObject({ displayValue: "", outputValue: "" });
    });
  });
});

describe("PhoneEditor.reset", () => {
  it("clears the digits and keeps the visible country without a default", () => {
    const typed = fill(PhoneEditor.create({}), "41234567");
    expect(shown(PhoneEditor.reset(typed))).toEqual({ display: "", output: "", country: "NO" });
    const picked = fill(PhoneEditor.selectCountry(PhoneEditor.create({}), "SE"), "701234567");
    expect(shown(PhoneEditor.reset(picked))).toEqual({ display: "", output: "", country: "SE" });
    const detected = fill(PhoneEditor.create({}), "+46701234567");
    expect(shown(detected).country).toBe("SE");
    expect(shown(PhoneEditor.reset(detected))).toEqual({ display: "", output: "", country: "SE" });
  });

  it.each([
    { international: true },
    { formatOnType: true },
    { outputFormat: "national" },
    { outputFormat: "raw" },
  ] as const)("clears values for %o", (props) => {
    const typed = fill(PhoneEditor.create(props), "41234567");
    expect(shown(PhoneEditor.reset(typed))).toEqual({ display: "", output: "", country: "NO" });
  });

  it("starts from the default number and reads it again under the props it has at reset", () => {
    const state = PhoneEditor.create({ defaultValue: "+4741234567" });
    expect(shown(state)).toEqual({ display: "41234567", output: "+4741234567", country: "NO" });
    const typed = fill(state, "99887766");
    expect(shown(typed)).toEqual({ display: "99887766", output: "+4799887766", country: "NO" });
    const formatted = PhoneEditor.reconcile(typed, { defaultValue: "+4741234567", formatOnType: true });
    expect(shown(PhoneEditor.reset(formatted))).toEqual({
      display: "41 23 45 67",
      output: "+4741234567",
      country: "NO",
    });
  });

  it("restores a default in another country", () => {
    const state = PhoneEditor.create({ defaultValue: "+46701234567" });
    expect(shown(state)).toEqual({ display: "701234567", output: "+46701234567", country: "SE" });
    const typed = fill(PhoneEditor.selectCountry(state, "NO"), "41234567");
    expect(shown(typed).country).toBe("NO");
    expect(shown(PhoneEditor.reset(typed))).toEqual({
      display: "701234567",
      output: "+46701234567",
      country: "SE",
    });
  });

  it("restores an empty default in the default country", () => {
    const state = PhoneEditor.create({ defaultValue: "", defaultCountryCode: "NO" });
    const typed = fill(PhoneEditor.selectCountry(state, "SE"), "701234567");
    expect(shown(PhoneEditor.reset(typed))).toEqual({ display: "", output: "", country: "NO" });
  });

  it("keeps the shown number when the default changes, and resets to the new default", () => {
    const state = PhoneEditor.create({ defaultValue: "+4741234567" });
    const changed = PhoneEditor.reconcile(state, { defaultValue: "+4799887766" });
    expect(shown(changed)).toEqual({ display: "41234567", output: "+4741234567", country: "NO" });
    expect(shown(PhoneEditor.reset(changed))).toEqual({
      display: "99887766",
      output: "+4799887766",
      country: "NO",
    });
  });
});

/**
 * `AsYouType#input` runs exactly once per libphonenumber parse: the engine builds one
 * `AsYouType` per parse, feeds it the number, and nothing else touches the parser. Patching
 * the shared prototype counts real parses without mocking the module.
 *
 * The budget is per path: a keystroke costs one parse, a paste that carries an international
 * prefix three (two in the detection pass, one for the output), a country change one, and
 * props that are equal in a new object none.
 */
describe("PhoneEditor parse budget", () => {
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

  it.each([
    ["default e164", {}],
    ["outputFormat national", { outputFormat: "national" }],
    ["international", { international: true }],
    ["formatOnType", { formatOnType: true }],
  ] as const)("parses once per keystroke in %s, while the controlled value echoes back", (_name, props) => {
    let state = PhoneEditor.create({ ...props, value: "" });
    expect(parses, "mount must not parse an empty value").toBe(0);
    for (const [index, key] of "41234567".split("").entries()) {
      state = echo(keyAt(state, PhoneEditor.view(state).displayValue.length, key), props);
      expect(parses, `after ${index + 1} keystroke(s)`).toBe(index + 1);
    }
  });

  it("costs three parses for a paste that carries an international prefix", () => {
    const state = echo(PhoneEditor.paste(PhoneEditor.create({ value: "" }), "+46701234567"));
    expect(PhoneEditor.view(state).displayValue).toBe("701234567");
    expect(parses).toBe(3);
  });

  it("costs one parse for a country change", () => {
    const props = { preserveOnCountryChange: true } as const;
    const typed = echo(fill(PhoneEditor.create({ ...props, value: "" }), "41234567"), props);
    parses = 0;
    echo(PhoneEditor.selectCountry(typed, "SE"), props);
    expect(parses).toBe(1);
  });

  it("costs nothing for equal props in a new object", () => {
    const props = { value: "+4741234567", countries: ["NO", "SE"], formatOnType: true } as const;
    const state = PhoneEditor.create(props);
    parses = 0;
    expect(PhoneEditor.reconcile(state, { ...props, countries: ["NO", "SE"] })).toBe(state);
    expect(parses).toBe(0);
  });
});
