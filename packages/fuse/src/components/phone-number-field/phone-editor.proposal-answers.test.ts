import type { MetadataJson } from "libphonenumber-js/core";
import maxMetadata from "libphonenumber-js/metadata.max.json";
import { describe, expect, it } from "vitest";

import { phoneEditorFixtures } from "../../../test/phone-editor-fixtures";
import * as PhoneEditor from "./phone-editor";
import type { PhoneEditorProps, PhoneEditorState } from "./phone-editor";
import { defaultMetadata } from "./phone-engine";

const { shown, proposedValue, echo } = phoneEditorFixtures(PhoneEditor);

/** Prop changes that arrive before the answer, each applied over the answer's base props. */
type Steps = readonly Partial<PhoneEditorProps>[];

function carryThrough(state: PhoneEditorState, props: PhoneEditorProps, steps: Steps): PhoneEditorState {
  return steps.reduce((current, step) => PhoneEditor.reconcile(current, { ...props, ...step }), state);
}

// Each answer arrives directly or after configuration changes that steer nothing. Those changes carry
// the proposal into their configuration, and the outcome matches the direct path either way.
describe("PhoneEditor proposal answers: an answer's outcome does not depend on a no-steer change before it", () => {
  it.each<[string, Steps, Partial<PhoneEditorProps>, string]>([
    ["directly", [], {}, "040 1234567"],
    ["after a format change", [{ outputFormat: "e164" }], {}, "040 1234567"],
    ["directly, with a format change", [], { outputFormat: "e164" }, "+358401234567"],
    ["after a format change, with it", [{ outputFormat: "e164" }], { outputFormat: "e164" }, "+358401234567"],
    [
      "after a raw format change, with it",
      [{ outputFormat: "raw" }],
      { outputFormat: "raw" },
      "+358401234567",
    ],
    // A metadata replacement that reads the proposal again unchanged keeps the output the parent heard.
    [
      "after a format change and a metadata replacement, with both",
      [{ outputFormat: "e164" }, { outputFormat: "e164", metadata: maxMetadata }],
      { outputFormat: "e164", metadata: maxMetadata },
      "+358401234567",
    ],
    [
      "after a format change, with it and a metadata replacement",
      [{ outputFormat: "e164" }],
      { outputFormat: "e164", metadata: maxMetadata },
      "+358401234567",
    ],
  ])(
    "shows a preserved pick's own display when the parent answers it with its output %s",
    (_name, between, change, output) => {
      const props = {
        countryCode: "NO",
        countries: ["FI", "NO", "SJ"],
        outputFormat: "national",
        preserveOnCountryChange: true,
        autoDetectCountry: false,
      } as const;
      const pasted = PhoneEditor.paste(PhoneEditor.create({ ...props, value: "" }), "+358401234567");
      const value = "040 1234567";
      expect(proposedValue(pasted)).toBe(value);
      // The preserved pick's output is the value the parent holds, so that value answers the number half.
      const picked = PhoneEditor.selectCountry(echo(pasted, props), "FI");
      expect(proposedValue(picked)).toBeNull();
      const carried = carryThrough(picked, { ...props, value }, between);
      expect(PhoneEditor.observeCountry(carried).proposed?.code).toBe("FI");
      const accepted = PhoneEditor.reconcile(carried, { ...props, value, ...change, countryCode: "FI" });
      expect(PhoneEditor.observeCountry(accepted).proposed).toBeNull();
      // The pick keeps its digits as typed, so the display leaves out the trunk 0 the user never typed.
      expect(shown(accepted)).toEqual({ display: "401234567", output, country: "FI" });
      expect(PhoneEditor.steeredValue(accepted)).toBeNull();
    }
  );

  it.each<[string, Steps]>([
    ["directly", []],
    ["after a format change and a metadata replacement", [{ outputFormat: "e164", metadata: maxMetadata }]],
  ])(
    "shows a preserved pick's own display when the parent answers it with its output and a metadata replacement %s",
    (_name, between) => {
      const props = {
        value: "+358 40 1234567",
        countryCode: "NO",
        countries: ["FI", "NO"],
        outputFormat: "national",
        preserveOnCountryChange: true,
        autoDetectCountry: false,
      } as const;
      const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "FI");
      const value = "040 1234567";
      // The parent hears the pick in the national output, with the trunk 0.
      expect(proposedValue(picked)).toBe(value);
      const carried = carryThrough(picked, props, between);
      expect(PhoneEditor.observeCountry(carried).proposed?.code).toBe("FI");
      const accepted = PhoneEditor.reconcile(carried, {
        ...props,
        value,
        countryCode: "FI",
        outputFormat: "e164",
        metadata: maxMetadata,
      });
      expect(PhoneEditor.observeCountry(accepted).proposed).toBeNull();
      // The pick keeps its digits as the value had them, so the display leaves out the national trunk 0.
      expect(shown(accepted)).toEqual({ display: "401234567", output: "+358401234567", country: "FI" });
    }
  );

  it.each<[string, Steps]>([
    ["directly", []],
    ["after a format change", [{ outputFormat: "e164" }]],
  ])("accepts a waiting paste the parent answers with the national output it heard %s", (_name, between) => {
    const props = {
      value: "",
      countryCode: "NO",
      outputFormat: "national",
      autoDetectCountry: false,
    } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create(props), "+358401234567");
    const value = "040 1234567";
    expect(proposedValue(pasted)).toBe(value);
    const carried = carryThrough(pasted, props, between);
    const accepted = PhoneEditor.reconcile(carried, { ...props, value, outputFormat: "e164" });
    // The field shows the paste's own number, not the heard national digits read again in NO.
    expect(shown(accepted)).toEqual({ display: "+358401234567", output: "+358401234567", country: "NO" });
  });

  it.each<[string, Steps]>([
    ["directly", []],
    ["after a format change", [{ outputFormat: "e164" }]],
  ])(
    "accepts a waiting pick the parent answers with its output and a code that falls back to its country %s",
    (_name, between) => {
      const props = {
        countryCode: "SE",
        countries: ["NO", "SE"],
        outputFormat: "national",
        preserveOnCountryChange: true,
        autoDetectCountry: false,
      } as const;
      const pasted = PhoneEditor.paste(PhoneEditor.create({ ...props, value: "" }), "+4741234567");
      const value = "41 23 45 67";
      expect(proposedValue(pasted)).toBe(value);
      const picked = PhoneEditor.selectCountry(echo(pasted, props), "NO");
      const carried = carryThrough(picked, { ...props, value }, between);
      // FI is not offered, so the country falls back to NO. The value already is the pick's output,
      // so the props show the pick and the editor accepts it instead of making a new pick.
      const accepted = PhoneEditor.reconcile(carried, {
        ...props,
        value,
        outputFormat: "e164",
        countryCode: "FI",
      });
      expect(PhoneEditor.observeCountry(accepted).proposed).toBeNull();
      expect(shown(accepted)).toEqual({ display: "41234567", output: "+4741234567", country: "NO" });
      expect(PhoneEditor.steeredValue(accepted)).toBeNull();
    }
  );

  it("keeps the output the parent holds when adopting a pick under a catalog that formats it apart", () => {
    const props = {
      value: "+47 79 12 34 56",
      countryCode: "NO",
      countries: ["NO", "SJ", "DK"],
      outputFormat: "national",
      preserveOnCountryChange: true,
      autoDetectCountry: false,
    } as const;
    const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "DK");
    const value = proposedValue(picked);
    expect(value).toBe("79 12 34 56");
    // A catalog without NO reads the same digits and number but formats the national output differently.
    const { NO: _norway, ...countries } = defaultMetadata.countries;
    const withoutNorway: MetadataJson = {
      ...defaultMetadata,
      countries,
      country_calling_codes: { ...defaultMetadata.country_calling_codes, "47": ["SJ"] },
    };
    const accepted = PhoneEditor.reconcile(picked, {
      ...props,
      value: value ?? "",
      countryCode: "DK",
      metadata: withoutNorway,
    });
    expect(shown(accepted).output).toBe("79 12 34 56");
  });
});
