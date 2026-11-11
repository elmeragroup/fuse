import { AsYouType } from "libphonenumber-js/core";
import maxMetadata from "libphonenumber-js/metadata.max.json";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { committedCountry, publishedCountry, startCountryNotices } from "./phone-country-notices";
import type { CountryNotice } from "./phone-country-notices";
import * as PhoneEditor from "./phone-editor";
import type { PhoneEditorProps, PhoneEditorState } from "./phone-editor";
import { defaultMetadata } from "./phone-engine";

/** The output the latest proposal sends `onChange`, or null. */
function proposedValue(state: PhoneEditorState): string | null {
  return PhoneEditor.proposalNotice(state)?.value ?? null;
}

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

/** Inserts `key` at the end of the display, as typing does. */
function typeAtEnd(state: PhoneEditorState, key: string): PhoneEditorState {
  const value = PhoneEditor.view(state).displayValue + key;
  return PhoneEditor.edit(state, {
    value,
    selectionStart: value.length,
    selectionEnd: value.length,
    selectionDirection: "none",
    inputType: "insertText",
  });
}

/**
 * The country `onCountryChange` hears as `after` proposes over `before`, through the notice
 * tracker the hook drives, after the commit of `before`.
 */
function announced(before: PhoneEditorState, after: PhoneEditorState): string | null {
  const first = PhoneEditor.observeCountry(before);
  const committed = committedCountry(startCountryNotices(first), first);
  return publishedCountry(committed.notices, PhoneEditor.observeCountry(after)).country?.code ?? null;
}

/** A controlled parent that takes every proposal back as its `value`. */
function echo(state: PhoneEditorState, props: PhoneEditorProps = {}): PhoneEditorState {
  const value = proposedValue(state) ?? PhoneEditor.view(state).outputValue;
  return PhoneEditor.reconcile(state, { ...props, value });
}

/**
 * `AsYouType#input` runs once per libphonenumber parse; patching the shared prototype counts
 * real parses without mocking the module.
 */
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

describe("PhoneEditor controlled countryCode", () => {
  /** An uncontrolled field in `countryCode` NO with "41234567" typed. */
  function typedInNorway(props: PhoneEditorProps = {}): PhoneEditorState {
    return fill(PhoneEditor.create({ ...props, countryCode: "NO" }), "41234567");
  }

  it("shows the country a controlled value names on mount, over countryCode", () => {
    expect(shown(PhoneEditor.create({ value: "+46701234567", countryCode: "NO" }))).toEqual({
      display: "701234567",
      output: "+46701234567",
      country: "SE",
    });
  });

  it("wins over defaultCountryCode on mount", () => {
    expect(shown(PhoneEditor.create({ countryCode: "SE", defaultCountryCode: "FI" }))).toEqual({
      display: "",
      output: "",
      country: "SE",
    });
  });

  it("steers an empty field to the new code and proposes no output", () => {
    const state = PhoneEditor.reconcile(PhoneEditor.create({ countryCode: "NO" }), { countryCode: "SE" });
    expect(shown(state)).toEqual({ display: "", output: "", country: "SE" });
    expect(PhoneEditor.steeredValue(state)).toBeNull();
  });

  it("clears the digits on a prop change, as a pick does, and proposes the cleared number", () => {
    const state = PhoneEditor.reconcile(typedInNorway(), { countryCode: "SE" });
    expect(shown(state)).toEqual({ display: "", output: "", country: "SE" });
    expect(PhoneEditor.steeredValue(state)).toEqual({ value: "" });
  });

  it("keeps the digits on a prop change under preserveOnCountryChange", () => {
    const props = { preserveOnCountryChange: true } as const;
    const state = PhoneEditor.reconcile(typedInNorway(props), { ...props, countryCode: "SE" });
    expect(shown(state)).toEqual({ display: "41234567", output: "+4641234567", country: "SE" });
    expect(PhoneEditor.steeredValue(state)).toEqual({ value: "+4641234567" });
  });

  it("gives each prop change a new proposal and keeps it across equal props", () => {
    const first = PhoneEditor.reconcile(typedInNorway(), { countryCode: "SE" });
    const proposal = PhoneEditor.steeredValue(first);
    expect(PhoneEditor.reconcile(first, { countryCode: "SE" })).toBe(first);
    const typed = fill(first, "701234567");
    expect(PhoneEditor.steeredValue(typed), "an edit replaces the proposal").toBeNull();
    const second = PhoneEditor.reconcile(typed, { countryCode: "NO" });
    expect(PhoneEditor.steeredValue(second)).toEqual({ value: "" });
    expect(PhoneEditor.steeredValue(second)).not.toBe(proposal);
  });

  it("reads a controlled value without a country in countryCode, and proposes the pick over it", () => {
    const props = { outputFormat: "raw" } as const;
    const mounted = PhoneEditor.create({ ...props, value: "701234567", countryCode: "SE" });
    expect(shown(mounted)).toEqual({ display: "701234567", output: "701234567", country: "SE" });

    const steered = PhoneEditor.reconcile(
      PhoneEditor.create({ ...props, value: "41234567", countryCode: "NO" }),
      {
        ...props,
        value: "41234567",
        countryCode: "SE",
      }
    );
    // The parent still holds its digits, so they show, read in the new country, until it takes
    // the cleared number.
    expect(shown(steered)).toEqual({ display: "41234567", output: "41234567", country: "SE" });
    expect(PhoneEditor.steeredValue(steered)).toEqual({ value: "" });
    expect(shown(PhoneEditor.reconcile(steered, { ...props, value: "", countryCode: "SE" }))).toEqual({
      display: "",
      output: "",
      country: "SE",
    });
  });

  it("reads a new controlled value without a country in countryCode, not in the country shown", () => {
    const disagreeing = PhoneEditor.create({ value: "+46701234567", countryCode: "NO" });
    expect(shown(disagreeing).country).toBe("SE");
    expect(shown(PhoneEditor.reconcile(disagreeing, { value: "41234567", countryCode: "NO" }))).toEqual({
      display: "41234567",
      output: "+4741234567",
      country: "NO",
    });
  });

  it("returns to the parent's country when it rejects a pick, and shows the pick it echoes", () => {
    const props = { countryCode: "NO" } as const;
    const typed = typedInNorway();
    const picked = PhoneEditor.selectCountry(typed, "SE");
    expect(announced(typed, picked)).toBe("SE");
    // An uncontrolled number reports only what the field shows, which waits for the country.
    expect(proposedValue(picked)).toBeNull();
    expect(shown(PhoneEditor.reconcile(picked, props))).toEqual({
      display: "41234567",
      output: "+4741234567",
      country: "NO",
    });

    const echoed = PhoneEditor.reconcile(picked, { countryCode: "SE" });
    expect(shown(echoed)).toEqual({ display: "", output: "", country: "SE" });
    expect(PhoneEditor.steeredValue(echoed), "the echo shows the cleared number").toEqual({ value: "" });
    expect(PhoneEditor.reconcile(echoed, { countryCode: "SE" })).toBe(echoed);
  });

  it("returns to the parent's country when it rejects a detected one", () => {
    const typed = typedInNorway();
    const pasted = PhoneEditor.paste(typed, "+46701234567");
    expect(announced(typed, pasted)).toBe("SE");
    expect(shown(PhoneEditor.reconcile(pasted, { countryCode: "NO" }))).toEqual({
      display: "41234567",
      output: "+4741234567",
      country: "NO",
    });
  });

  it("proposes no country for an edit that keeps it, even beside a value that names another", () => {
    expect(announced(PhoneEditor.create({ countryCode: "NO" }), typedInNorway())).toBeNull();
    const disagreeing = PhoneEditor.create({ value: "+4670123456", countryCode: "NO" });
    const typed = typeAtEnd(disagreeing, "7");
    // The field already announced SE; an edit in SE continues that disagreement.
    expect(announced(disagreeing, typed)).toBeNull();
    // The edit keeps SE, which the parent never set, and shows once the parent echoes its value.
    expect(shown(echo(typed, { countryCode: "NO" }))).toEqual({
      display: "701234567",
      output: "+46701234567",
      country: "SE",
    });
  });

  it("proposes no country without a controlled countryCode", () => {
    const state = PhoneEditor.create({});
    expect(announced(state, PhoneEditor.selectCountry(state, "SE"))).toBeNull();
  });

  it.each([
    ["typed national digits", {}],
    ["an international display", { international: true }],
  ] as const)(
    "lets an echoed value that names its country win over a prop change, after %s",
    (_name, props) => {
      const typed = echo(fill(PhoneEditor.create({ ...props, value: "", countryCode: "NO" }), "41234567"), {
        ...props,
        countryCode: "NO",
      });
      expect(shown(typed)).toMatchObject({ output: "+4741234567", country: "NO" });
      const steered = PhoneEditor.reconcile(typed, { ...props, value: "+4741234567", countryCode: "SE" });
      expect(shown(steered)).toMatchObject({ output: "+4741234567", country: "NO" });
      expect(PhoneEditor.steeredValue(steered)).toBeNull();
    }
  );

  it("steers an echoed raw value detected from a prefix, which names no country", () => {
    const props = { outputFormat: "raw" } as const;
    const pasted = PhoneEditor.paste(
      PhoneEditor.create({ ...props, value: "", countryCode: "NO" }),
      "+46701234567"
    );
    const echoed = PhoneEditor.reconcile(pasted, { ...props, value: "701234567", countryCode: "SE" });
    expect(shown(echoed)).toEqual({ display: "701234567", output: "701234567", country: "SE" });
    const steered = PhoneEditor.reconcile(echoed, { ...props, value: "701234567", countryCode: "NO" });
    expect(shown(steered)).toEqual({ display: "701234567", output: "701234567", country: "NO" });
    expect(PhoneEditor.steeredValue(steered)).toEqual({ value: "" });
  });

  it("reads a value accepted from a rejected pick in the parent's country", () => {
    const picked = PhoneEditor.selectCountry(
      PhoneEditor.create({ value: "+4741234567", countryCode: "NO" }),
      "SE"
    );
    expect(proposedValue(picked)).toBe("");
    expect(shown(PhoneEditor.reconcile(picked, { value: "", countryCode: "NO" }))).toEqual({
      display: "",
      output: "",
      country: "NO",
    });
  });

  it("shows a detected country when the accepted value names it, though the parent keeps its code", () => {
    const pasted = PhoneEditor.paste(PhoneEditor.create({ value: "", countryCode: "NO" }), "+46701234567");
    expect(shown(PhoneEditor.reconcile(pasted, { value: "+46701234567", countryCode: "NO" }))).toEqual({
      display: "701234567",
      output: "+46701234567",
      country: "SE",
    });
  });

  it("keeps the shown country and number when the parent releases the country after rejecting a pick", () => {
    const rejected = PhoneEditor.reconcile(PhoneEditor.selectCountry(typedInNorway(), "SE"), {
      countryCode: "NO",
    });
    const released = PhoneEditor.reconcile(rejected, {});
    expect(shown(released)).toEqual({ display: "41234567", output: "+4741234567", country: "NO" });
    expect(proposedValue(released)).toBeNull();
  });

  it("keeps a controlled value that names its country when the catalog starts offering the code", () => {
    const props = { value: "+4741234567", countryCode: "SE" } as const;
    const state = PhoneEditor.create({ ...props, countries: ["NO", "FI"] });
    expect(shown(state).country).toBe("NO");
    const expanded = PhoneEditor.reconcile(state, { ...props, countries: ["NO", "FI", "SE"] });
    expect(shown(expanded)).toEqual({ display: "41234567", output: "+4741234567", country: "NO" });
    expect(PhoneEditor.steeredValue(expanded)).toBeNull();
  });

  describe("review round 2", () => {
    it("lets the country a value names win over a preserved pick the parent accepts without the value", () => {
      const props = { value: "+4741234567", international: true, preserveOnCountryChange: true } as const;
      const picked = PhoneEditor.selectCountry(PhoneEditor.create({ ...props, countryCode: "NO" }), "SE");
      const accepted = PhoneEditor.reconcile(picked, { ...props, countryCode: "SE" });
      expect(shown(accepted)).toMatchObject({ output: "+4741234567", country: "NO" });
    });

    it("reads a countryless echo in countryCode, not in the country the previous value named", () => {
      const props = { outputFormat: "raw", countryCode: "NO" } as const;
      const named = PhoneEditor.create({ ...props, value: "+4670123456" });
      expect(shown(named).country).toBe("SE");
      const edited = fill(named, "701234567");
      expect(proposedValue(edited)).toBe("701234567");
      expect(shown(PhoneEditor.reconcile(edited, { ...props, value: "701234567" }))).toEqual({
        display: "701234567",
        output: "701234567",
        country: "NO",
      });
    });

    it.each([["formatOnType", { formatOnType: true }]] as const)(
      "reports the cleared number of a pick accepted together with a change to %s",
      (_name, change) => {
        const picked = PhoneEditor.selectCountry(typedInNorway(), "SE");
        const accepted = PhoneEditor.reconcile(picked, { ...change, countryCode: "SE" });
        expect(shown(accepted)).toEqual({ display: "", output: "", country: "SE" });
        expect(PhoneEditor.steeredValue(accepted)).toEqual({ value: "" });
      }
    );

    it("clears on a countryCode change that also drops the old country from the catalog", () => {
      const typed = fill(PhoneEditor.create({ countryCode: "NO", countries: ["NO", "SE"] }), "41234567");
      const steered = PhoneEditor.reconcile(typed, { countryCode: "SE", countries: ["SE"] });
      expect(shown(steered)).toEqual({ display: "", output: "", country: "SE" });
      expect(PhoneEditor.steeredValue(steered)).toEqual({ value: "" });
    });

    it("reads the controlled value itself in the steered country, keeping its trunk 0", () => {
      const props = { outputFormat: "national", preserveOnCountryChange: true } as const;
      const pasted = PhoneEditor.paste(
        PhoneEditor.create({ ...props, value: "", countryCode: "SE" }),
        "+46701234567"
      );
      expect(proposedValue(pasted)).toBe("070-123 45 67");
      const echoed = PhoneEditor.reconcile(pasted, { ...props, value: "070-123 45 67", countryCode: "SE" });
      const steered = PhoneEditor.reconcile(echoed, { ...props, value: "070-123 45 67", countryCode: "NO" });
      expect(shown(steered)).toMatchObject({ display: "0701234567", country: "NO" });
      expect(PhoneEditor.steeredValue(steered)?.value.replace(/\D/g, "")).toBe("0701234567");
    });

    it("shows the country a controlled value names once the catalog offers it", () => {
      const props = { value: "+46701234567", countryCode: "SE" } as const;
      const state = PhoneEditor.create({ ...props, countries: ["NO"] });
      expect(shown(state).country).toBe("NO");
      expect(shown(PhoneEditor.reconcile(state, { ...props, countries: ["NO", "SE"] }))).toEqual({
        display: "701234567",
        output: "+46701234567",
        country: "SE",
      });
    });
  });

  it("keeps an uncontrolled default from another country in international form beside countryCode", () => {
    const state = PhoneEditor.create({ defaultValue: "+46701234567", countryCode: "NO" });
    expect(shown(state)).toEqual({ display: "+46701234567", output: "+46701234567", country: "NO" });
    expect(shown(PhoneEditor.reset(fill(state, "")))).toEqual(shown(state));
  });

  it("resets to the default number read in countryCode", () => {
    const state = PhoneEditor.create({
      defaultValue: "41234567",
      countryCode: "SE",
      defaultCountryCode: "NO",
    });
    expect(shown(PhoneEditor.reset(fill(state, "")))).toEqual({
      display: "41234567",
      output: "+4641234567",
      country: "SE",
    });
  });
});

describe("PhoneEditor value authority", () => {
  it("B: reads country authority from the value alone, so a partial international value steers", () => {
    const typed = fill(PhoneEditor.create({ value: "", countryCode: "US" }), "0");
    expect(proposedValue(typed)).toBe("+10");
    const echoed = PhoneEditor.reconcile(typed, { value: "+10", countryCode: "US" });
    expect(shown(echoed).country).toBe("US");
    const steered = PhoneEditor.reconcile(echoed, { value: "+10", countryCode: "NO" });
    expect(shown(steered).country).toBe("NO");
    expect(PhoneEditor.steeredValue(steered)).toEqual({ value: "" });
  });
});

describe("PhoneEditor without a controlled country", () => {
  it.each([
    [
      "a repeated trunk prefix",
      "+4600701234567",
      { display: "701234567", output: "+46701234567", country: "SE" },
    ],
    ["a calling code and two trunk zeros", "+4600", { display: "0", output: "", country: "SE" }],
  ] as const)("reads %s in a detected default as pasting the same text does", (_name, text, expected) => {
    expect(shown(PhoneEditor.create({ defaultValue: text }))).toEqual(expected);
    expect(shown(PhoneEditor.paste(PhoneEditor.create({}), text))).toEqual(expected);
  });

  it("keeps an international entry as typed through a metadata replacement", () => {
    const props = { defaultValue: "+47 41 23 45 67", international: true, outputFormat: "raw" } as const;
    const replaced = PhoneEditor.reconcile(PhoneEditor.create(props), { ...props, metadata: maxMetadata });
    expect(shown(replaced)).toEqual({ display: "+47 41 23 45 67", output: "+47 41 23 45 67", country: "NO" });
    expect(PhoneEditor.steeredValue(replaced)).toBeNull();
  });

  it("keeps the shown number when the parent releases a value it held against a proposal", () => {
    const pasted = PhoneEditor.paste(PhoneEditor.create({ value: "+4741234567" }), "+46701234567");
    // The parent rejects the paste by keeping its value, then gives up control of the value.
    const rejected = PhoneEditor.reconcile(pasted, { value: "+4741234567" });
    expect(shown(PhoneEditor.reconcile(rejected, {}))).toEqual({
      display: "41234567",
      output: "+4741234567",
      country: "NO",
    });
  });

  it("keeps a waiting proposal through a change to defaults only, as the base editor does", () => {
    const props = { value: "", outputFormat: "national" } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create(props), "+46701234567");
    expect(proposedValue(pasted)).toBe("070-123 45 67");
    const defaulted = PhoneEditor.reconcile(pasted, { ...props, defaultCountryCode: "FI" });
    const echoed = PhoneEditor.reconcile(defaulted, {
      ...props,
      defaultCountryCode: "FI",
      value: "070-123 45 67",
    });
    expect(shown(echoed)).toEqual({ display: "701234567", output: "070-123 45 67", country: "SE" });
  });
});

describe("PhoneEditor answers to a proposal", () => {
  it("keeps a value-first answer that comes with a formatting change, so the country answer clears nothing", () => {
    const props = { outputFormat: "raw", countryCode: "NO" } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create({ ...props, value: "41234567" }), "+46701234567");
    const answered = PhoneEditor.reconcile(pasted, { ...props, value: "701234567", formatOnType: true });
    const accepted = PhoneEditor.reconcile(answered, {
      ...props,
      value: "701234567",
      formatOnType: true,
      countryCode: "SE",
    });
    expect(PhoneEditor.steeredValue(accepted)).toBeNull();
    expect(shown(accepted)).toMatchObject({ output: "701234567", country: "SE" });
  });

  it("keeps a waiting pick through a catalog change that still offers its country", () => {
    const props = {
      value: "41234567",
      outputFormat: "raw",
      countryCode: "NO",
      countries: ["NO", "SE", "SJ"],
    } as const;
    const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "SE");
    expect(proposedValue(picked)).toBe("");
    const widened = PhoneEditor.reconcile(picked, { ...props, countries: ["FI", "NO", "SE", "SJ"] });
    const accepted = PhoneEditor.reconcile(widened, {
      ...props,
      countries: ["FI", "NO", "SE", "SJ"],
      countryCode: "SE",
    });
    // The pick already told the parent its cleared number; the country answer clears nothing new.
    expect(PhoneEditor.steeredValue(accepted)).toBeNull();
    expect(shown(accepted)).toEqual({ display: "41234567", output: "41234567", country: "SE" });
  });

  it("matches a national answer to an international entry with a trunk zero by its number", () => {
    const props = { international: true, countryCode: "NO" } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create({ ...props, value: "" }), "+44 (0)20 1234 5678");
    const answered = PhoneEditor.reconcile(pasted, { ...props, value: "02012345678" });
    const accepted = PhoneEditor.reconcile(answered, { ...props, value: "02012345678", countryCode: "GB" });
    expect(PhoneEditor.steeredValue(accepted)).toBeNull();
    expect(shown(accepted)).toMatchObject({ output: "+442012345678", country: "GB" });
  });

  it("ends a proposal the parent answers in full, and announces the country the value names", () => {
    const props = { value: "+4741234567", international: true, preserveOnCountryChange: true } as const;
    let state = PhoneEditor.create({ ...props, countryCode: "NO" });
    let notices = startCountryNotices(PhoneEditor.observeCountry(state));
    const heard: string[] = [];
    const take = (notice: CountryNotice) => {
      notices = notice.notices;
      if (notice.country) heard.push(notice.country.code);
    };
    take(committedCountry(notices, PhoneEditor.observeCountry(state)));
    state = PhoneEditor.selectCountry(state, "SE");
    // The preserved pick's output is the value the parent holds, so `onChange` hears nothing.
    expect(proposedValue(state)).toBeNull();
    take(publishedCountry(notices, PhoneEditor.observeCountry(state)));
    state = PhoneEditor.reconcile(state, { ...props, countryCode: "SE" });
    take(committedCountry(notices, PhoneEditor.observeCountry(state)));
    expect(shown(state)).toEqual({ display: "+4741234567", output: "+4741234567", country: "NO" });
    expect(PhoneEditor.observeCountry(state).proposed).toBeNull();
    expect(heard).toEqual(["SE", "NO"]);
  });

  it("tells a parent that stores another form the number a countryCode change shows, as a pick does", () => {
    const props = { value: "41234567", preserveOnCountryChange: true } as const;
    const state = PhoneEditor.create({ ...props, countryCode: "NO" });
    expect(proposedValue(PhoneEditor.selectCountry(state, "SJ"))).toBe("+4741234567");
    expect(PhoneEditor.steeredValue(PhoneEditor.reconcile(state, { ...props, countryCode: "SJ" }))).toEqual({
      value: "+4741234567",
    });
  });
});

describe("PhoneEditor answers after a formatting change", () => {
  it("ends a pick whose number the parent held before a formatting change, once it sets the country", () => {
    const props = {
      value: "+47 41 23 45 67",
      outputFormat: "international",
      countryCode: "NO",
      countries: ["NO", "SJ"],
      preserveOnCountryChange: true,
    } as const;
    const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "SJ");
    // The pick keeps the number, so the parent holds its output and hears no value.
    expect(proposedValue(picked)).toBeNull();
    const reformatted = PhoneEditor.reconcile(picked, { ...props, outputFormat: "e164" });
    const answered = PhoneEditor.reconcile(reformatted, {
      ...props,
      outputFormat: "e164",
      countryCode: "SJ",
    });
    // Both halves are answered: the value held, the country set. The value names NO, which the
    // field shows, and nothing waits for the parent.
    expect(PhoneEditor.observeCountry(answered).proposed).toBeNull();
    expect(shown(answered).country).toBe("NO");
  });
});

describe("PhoneEditor controlled country parse budget", () => {
  it.each([
    ["an uncontrolled number it keeps", { preserveOnCountryChange: true }],
    ["a controlled raw value it reads in the new country", { outputFormat: "raw", value: "41234567" }],
  ] as const)(
    "costs one parse for a countryCode change over %s, and none for equal props",
    (_name, props) => {
      const state = fill(PhoneEditor.create({ ...props, countryCode: "NO" }), "41234567");
      const held = PhoneEditor.reconcile(state, { ...props, countryCode: "NO" });
      parses = 0;
      const steered = PhoneEditor.reconcile(held, { ...props, countryCode: "SE" });
      expect(shown(steered)).toMatchObject({ display: "41234567", country: "SE" });
      expect(parses).toBe(1);
      parses = 0;
      expect(PhoneEditor.reconcile(steered, { ...props, countryCode: "SE" })).toBe(steered);
      expect(parses).toBe(0);
    }
  );

  it.each<[string, () => PhoneEditorState, PhoneEditorProps, number, ReturnType<typeof shown>]>([
    [
      "a partial international value read on mount",
      () => PhoneEditor.create({ value: "+10", defaultCountryCode: "US" }),
      { value: "+10", defaultCountryCode: "US", countryCode: "NO" },
      // The mount's parse of "+10" serves the read in NO.
      0,
      { display: "+10", output: "+10", country: "NO" },
    ],
    [
      "a partial international value echoed from typing",
      () =>
        echo(fill(PhoneEditor.create({ value: "", defaultCountryCode: "US" }), "0"), {
          defaultCountryCode: "US",
        }),
      { value: "+10", defaultCountryCode: "US", countryCode: "NO" },
      1,
      { display: "+10", output: "+10", country: "NO" },
    ],
    [
      "an uncontrolled number it keeps",
      () => fill(PhoneEditor.create({ preserveOnCountryChange: true }), "41234567"),
      { preserveOnCountryChange: true, countryCode: "SE" },
      1,
      { display: "41234567", output: "+4641234567", country: "SE" },
    ],
    [
      "a formatted value that names its own country, shown beside a pick of a country sharing its code",
      () => {
        const props = { outputFormat: "international", preserveOnCountryChange: true } as const;
        const pasted = PhoneEditor.paste(PhoneEditor.create({ ...props, value: "" }), "+4741234567");
        const echoed = PhoneEditor.reconcile(pasted, { ...props, value: "+47 41 23 45 67" });
        return PhoneEditor.selectCountry(echoed, "SJ");
      },
      {
        outputFormat: "international",
        preserveOnCountryChange: true,
        value: "+47 41 23 45 67",
        countryCode: "FI",
      },
      // The paste parsed the value's own input, spacing aside, so detecting its country and its
      // read in NO reuse that parse.
      0,
      { display: "41234567", output: "+47 41 23 45 67", country: "NO" },
    ],
    [
      "a value that names its own country, shown beside a preserved pick",
      () =>
        PhoneEditor.selectCountry(
          PhoneEditor.create({ value: "+4741234567", international: true, preserveOnCountryChange: true }),
          "SE"
        ),
      { value: "+4741234567", international: true, preserveOnCountryChange: true, countryCode: "FI" },
      // The mount's parse of the value serves its read back in NO.
      0,
      { display: "+4741234567", output: "+4741234567", country: "NO" },
    ],
    [
      "a value that names its own country",
      () => PhoneEditor.create({ value: "+4741234567" }),
      { value: "+4741234567", countryCode: "SE" },
      0,
      { display: "41234567", output: "+4741234567", country: "NO" },
    ],
  ])("costs at most one parse to start country control over %s", (_name, start, props, cost, expected) => {
    const state = start();
    parses = 0;
    const controlled = PhoneEditor.reconcile(state, props);
    expect(parses).toBe(cost);
    expect(shown(controlled)).toEqual(expected);
  });

  it.each<[string, PhoneEditorProps, ReturnType<typeof shown>]>([
    [
      "a value that names its own country",
      { value: "+46701234567" },
      { display: "701234567", output: "+46701234567", country: "SE" },
    ],
    [
      "a countryless value",
      { value: "41234567", outputFormat: "raw" },
      { display: "41234567", output: "41234567", country: "NO" },
    ],
    ["an uncontrolled number", {}, { display: "", output: "", country: "NO" }],
  ])("costs no parse to release country control over %s", (_name, props, expected) => {
    const state = PhoneEditor.create({ ...props, countryCode: "NO" });
    parses = 0;
    const released = PhoneEditor.reconcile(state, props);
    expect(parses).toBe(0);
    expect(shown(released)).toEqual(expected);
  });

  it("costs one parse for a value-first exact echo, the read of the value in the shown country", () => {
    const props = { outputFormat: "raw", countryCode: "NO" } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create({ ...props, value: "41234567" }), "+46701234567");
    expect(proposedValue(pasted)).toBe("701234567");
    parses = 0;
    // The parent takes the value before the country, in a render of its own.
    const echoed = PhoneEditor.reconcile(pasted, { ...props, value: "701234567" });
    expect(parses).toBe(1);
    expect(shown(echoed)).toEqual({ display: "701234567", output: "701234567", country: "NO" });
    parses = 0;
    const accepted = PhoneEditor.reconcile(echoed, { ...props, value: "701234567", countryCode: "SE" });
    expect(parses).toBeLessThanOrEqual(1);
    expect(shown(accepted)).toEqual({ display: "701234567", output: "701234567", country: "SE" });
    expect(PhoneEditor.steeredValue(accepted)).toBeNull();
  });

  it.each([
    ["a countryless value", "41234567", { display: "41234567", output: "+4741234567", country: "NO" }],
    [
      "a value that names its country",
      "+46701234567",
      { display: "701234567", output: "+46701234567", country: "SE" },
    ],
    // The `00` international prefix normalizes to the `+` input its national number is read
    // from again, so that read reuses the parse.
    ["a 00 prefix", "00 44 20 1234 5678", { display: "2012345678", output: "+442012345678", country: "GB" }],
  ] as const)("costs one parse for a new controlled value: %s", (_name, value, expected) => {
    const state = PhoneEditor.create({ value: "", countryCode: "NO" });
    parses = 0;
    const read = PhoneEditor.reconcile(state, { value, countryCode: "NO" });
    expect(parses).toBe(1);
    expect(shown(read)).toEqual(expected);
  });

  it.each([
    ["a bracketed trunk zero", "+44 (0)20 1234 5678"],
    ["a spaced bracketed trunk zero", "+44 (0) 20 1234 5678"],
  ] as const)(
    "costs two parses for a new controlled value with %s, one fewer than the base",
    (_name, value) => {
      const state = PhoneEditor.create({ value: "", countryCode: "NO" });
      parses = 0;
      const read = PhoneEditor.reconcile(state, { value, countryCode: "NO" });
      // The value as written, then its national number behind the calling code, a different input:
      // libphonenumber strips a trunk prefix once per parse, so a parse of one input is no parse of
      // the other. The base editor charges three.
      expect(parses).toBe(2);
      expect(shown(read)).toEqual({ display: "2012345678", output: "+442012345678", country: "GB" });
    }
  );

  it("costs two parses for a value-first answer in the parent's own form of the number", () => {
    const props = { outputFormat: "raw", countryCode: "NO" } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create({ ...props, value: "41234567" }), "+46701234567");
    parses = 0;
    // The parent stores the number with its trunk 0, before it takes the country.
    const answered = PhoneEditor.reconcile(pasted, { ...props, value: "0701234567" });
    // One parse reads the value in NO, where the precedence shows it; one reads it in SE, to know
    // it is the proposal's number.
    expect(parses).toBe(2);
    expect(shown(answered)).toEqual({ display: "0701234567", output: "0701234567", country: "NO" });
    parses = 0;
    const accepted = PhoneEditor.reconcile(answered, { ...props, value: "0701234567", countryCode: "SE" });
    expect(parses).toBeLessThanOrEqual(1);
    expect(shown(accepted).country).toBe("SE");
    expect(PhoneEditor.steeredValue(accepted)).toBeNull();
  });

  it("costs one parse for a catalog change that starts offering the controlled code", () => {
    const props = { preserveOnCountryChange: true, countryCode: "SE" } as const;
    const state = fill(PhoneEditor.create({ ...props, countries: ["NO"] }), "41234567");
    parses = 0;
    const expanded = PhoneEditor.reconcile(state, { ...props, countries: ["NO", "SE"] });
    expect(shown(expanded)).toEqual({ display: "41234567", output: "+4641234567", country: "SE" });
    // The move to the country the catalog now offers is a pick, decided before any snapshot is
    // built, so the digits are read once, there.
    expect(parses).toBe(1);
    parses = 0;
    expect(PhoneEditor.reconcile(expanded, { ...props, countries: ["NO", "SE"] })).toBe(expanded);
    expect(parses).toBe(0);
  });

  it("costs no parse for a catalog change that moves the controlled code to the country a value names", () => {
    const props = {
      outputFormat: "raw",
      value: "+4779123456",
      autoDetectCountry: true,
      countryCode: "SJ",
    } as const;
    const state = PhoneEditor.create({ ...props, countries: ["NO"] });
    parses = 0;
    const offered = PhoneEditor.reconcile(state, { ...props, countries: ["FI", "SJ"] });
    expect(shown(offered).country).toBe("SJ");
    // The country is decided before the number is read: the value names SJ, and the parse of its
    // international form the value's detection made already serves the read there.
    expect(parses).toBe(0);
  });

  it("costs one parse for an echo of the output the parent heard before a formatting change", () => {
    const props = {
      value: "0046 70 123 45 67",
      countries: ["SE"],
      outputFormat: "national",
      countryCode: "FI",
    } as const;
    const edited = fill(PhoneEditor.create(props), "79123456");
    const heard = proposedValue(edited);
    expect(heard).toBe("79123456");
    const reformatted = PhoneEditor.reconcile(edited, {
      ...props,
      countries: ["NO", "SE"],
      outputFormat: "e164",
      autoDetectCountry: true,
    });
    parses = 0;
    const echoed = PhoneEditor.reconcile(reformatted, {
      ...props,
      countries: ["NO", "SE"],
      outputFormat: "e164",
      autoDetectCountry: true,
      value: "79123456",
    });
    // The read of the value in the shown country; the echo of what the parent heard holds the
    // proposal's number without a comparison.
    expect(parses).toBe(1);
    expect(PhoneEditor.steeredValue(echoed)).toBeNull();
  });

  it("costs two parses for a number answer in the parent's own form that comes with a formatting change", () => {
    const props = {
      value: "",
      countryCode: "FI",
      countries: ["NO", "SE", "SJ"],
      international: true,
    } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create(props), "+46701234567");
    parses = 0;
    const answered = PhoneEditor.reconcile(pasted, { ...props, value: "0701234567", international: false });
    // The proposal waits for its country, its number answered.
    expect(PhoneEditor.observeCountry(answered).proposed?.code).toBe("SE");
    // The base editor charges one parse for the new value. The other reads the value in the
    // proposal's country, which both matches its number and is kept as the waiting proposal.
    expect(parses).toBe(2);
  });

  it("costs one parse for a metadata replacement under a controlled country another prefix names", () => {
    const props = { defaultValue: "+358401234567", countryCode: "SJ", countries: ["FI", "SJ"] } as const;
    const state = PhoneEditor.create({ ...props, metadata: maxMetadata });
    expect(shown(state)).toMatchObject({ output: "+358401234567", country: "SJ" });
    parses = 0;
    const replaced = PhoneEditor.reconcile(state, { ...props, metadata: defaultMetadata });
    expect(shown(replaced)).toMatchObject({ output: "+358401234567", country: "SJ" });
    // The number is read once, in SJ, the controlled country: never read first in FI, which its
    // prefix detects, and read again in SJ.
    expect(parses).toBe(1);
  });

  it("costs no parse to reformat a controlled national draft and a waiting national paste", () => {
    const props = {
      countryCode: "GB",
      defaultCountryCode: "GB",
      countries: ["GB"],
      value: "0",
      autoDetectCountry: false,
      metadata: maxMetadata,
    } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create(props), "2012345678");
    const unanswered = PhoneEditor.reconcile(pasted, props);
    parses = 0;
    const reformatted = PhoneEditor.reconcile(unanswered, { ...props, formatOnType: true });
    // The controlled draft and the waiting paste both stay.
    expect(shown(reformatted)).toMatchObject({ display: "0", country: "GB" });
    expect(PhoneEditor.observeCountry(reformatted).proposed?.code).toBe("GB");
    // The formatting flags only format what a parse found: both re-derive from the parses already
    // made of the same digits in GB.
    expect(parses).toBe(0);
  });

  it("costs one parse to start country control over an adopted raw echo of a pasted bracketed trunk zero", () => {
    const props = { value: "", outputFormat: "raw", autoDetectCountry: false } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create(props), "+44 (0)20 1234 5678");
    const echoed = PhoneEditor.reconcile(pasted, { ...props, value: "+44 (0)20 1234 5678" });
    const detecting = PhoneEditor.reconcile(echoed, {
      ...props,
      value: "+44 (0)20 1234 5678",
      autoDetectCountry: true,
    });
    parses = 0;
    const controlled = PhoneEditor.reconcile(detecting, {
      ...props,
      value: "+44 (0)20 1234 5678",
      autoDetectCountry: true,
      countryCode: "NO",
    });
    expect(shown(controlled)).toEqual({ display: "2012345678", output: "2012345678", country: "GB" });
    // The paste already parsed the text the value holds, so detecting GB from it reuses that parse;
    // the one parse reads the national number behind the calling code, another input.
    expect(parses).toBe(1);
  });

  it("costs one parse for a country answer that comes with a formatting change", () => {
    const props = { value: "41234567", countryCode: "NO" } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create(props), "+46701234567");
    parses = 0;
    const answered = PhoneEditor.reconcile(pasted, { ...props, countryCode: "SE", formatOnType: true });
    expect(shown(answered)).toMatchObject({ output: "+4641234567", country: "SE" });
    // The proposal still waits for its number.
    expect(PhoneEditor.observeCountry(answered).proposed?.code).toBe("SE");
    // The base editor charges one parse for `formatOnType` alone, the number re-derived. Here
    // that one parse reads the value in SE, decided first, and the waiting proposal, written
    // with its `+`, re-derives from the parse it made of that.
    expect(parses).toBe(1);
  });
});

describe("PhoneEditor review round 4", () => {
  it("1: keeps a waiting proposal through an equivalent metadata object, so a delayed code shows it", () => {
    const pasted = PhoneEditor.paste(PhoneEditor.create({ countryCode: "NO" }), "+46701234567");
    const metadata = { ...defaultMetadata };
    const rerendered = PhoneEditor.reconcile(pasted, { countryCode: "NO", metadata });
    expect(PhoneEditor.reconcile(rerendered, { countryCode: "NO", metadata: { ...defaultMetadata } })).toBe(
      rerendered
    );
    const accepted = PhoneEditor.reconcile(rerendered, { countryCode: "SE", metadata });
    expect(shown(accepted)).toEqual({ display: "701234567", output: "+46701234567", country: "SE" });
  });

  it.each([["a catalog that drops the value's country", { countries: ["NO"] }]] as const)(
    "2: keeps the number when %s leaves the controlled country unchanged",
    (_name, change) => {
      const props = { value: "+46701234567", countryCode: "NO", countries: ["NO", "SE"] } as const;
      const state = PhoneEditor.create(props);
      expect(shown(state).country).toBe("SE");
      const changed = PhoneEditor.reconcile(state, { ...props, ...change });
      expect(shown(changed)).toEqual({ display: "+46701234567", output: "+46701234567", country: "NO" });
      expect(PhoneEditor.steeredValue(changed)).toBeNull();
    }
  );

  it("3: keeps the controlled country when replaced metadata would detect another", () => {
    const props = { value: "4165551234", outputFormat: "raw", countryCode: "US" } as const;
    const state = PhoneEditor.create(props);
    expect(shown(state).country).toBe("US");
    const replaced = PhoneEditor.reconcile(state, { ...props, metadata: maxMetadata });
    expect(shown(replaced)).toMatchObject({ output: "4165551234", country: "US" });
    expect(PhoneEditor.steeredValue(replaced)).toBeNull();
    expect(PhoneEditor.reconcile(replaced, { ...props, metadata: maxMetadata })).toBe(replaced);
  });
});
