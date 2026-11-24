import type { MetadataJson } from "libphonenumber-js/core";
import maxMetadata from "libphonenumber-js/metadata.max.json";
import { describe, expect, it } from "vitest";

import { phoneEditorFixtures } from "../../../test/phone-editor-fixtures";
import * as PhoneEditor from "./phone-editor";
import type { PhoneEditorProps, PhoneEditorState } from "./phone-editor";
import { defaultMetadata } from "./phone-engine";
import type { PhoneCountryCode, PhoneNumberFormat } from "./phone-engine";

const { fill, shown, proposedValue, echo } = phoneEditorFixtures(PhoneEditor);

// A catalog without NO, so SJ is the only country for +47. It reads the same digits and number as
// the default catalog but formats the national output differently.
const { NO: _norway, ...countriesWithoutNorway } = defaultMetadata.countries;
const withoutNorway: MetadataJson = {
  ...defaultMetadata,
  countries: countriesWithoutNorway,
  country_calling_codes: { ...defaultMetadata.country_calling_codes, "47": ["SJ"] },
};

// The default catalog with SE's national trunk prefix removed.
const seWithoutTrunkPrefix: MetadataJson = {
  ...defaultMetadata,
  countries: { ...defaultMetadata.countries, SE: defaultMetadata.countries.SE?.slice(0, 5) },
};

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
    // #710: the output the parent holds answers the number half, whatever carry comes before the country.
    ["after the parent holds the output it heard", [{ value: "040 1234567" }]],
    [
      "after the parent holds the output it heard, then a format change and a metadata replacement",
      [{ value: "040 1234567" }, { value: "040 1234567", outputFormat: "e164", metadata: maxMetadata }],
    ],
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
      expect(PhoneEditor.steeredValue(accepted)).toBeNull();
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
    const accepted = PhoneEditor.reconcile(picked, {
      ...props,
      value: value ?? "",
      countryCode: "DK",
      metadata: withoutNorway,
    });
    expect(shown(accepted).output).toBe("79 12 34 56");
  });
});

// #710: an answer judged against an output that a no-steer carry gave the proposal. Each row reaches
// the same final props directly or after the configuration change alone, and both paths must show
// the outcome the answer itself decides.
describe("PhoneEditor proposal answers: a carried output is no answer the parent gave", () => {
  // The rule from #710: a carried output is no answer the parent gave. A format change carries the
  // pick into an output equal to the value the parent held before the pick: under raw output the
  // old value as written, under international output "+46 7". That answers nothing, so the pick
  // waits for its number whether the format change comes before the country answer, with it, or
  // only with the echo, and the echo of the output the parent heard adopts it in each order.
  it.each<{
    format: PhoneNumberFormat;
    start: PhoneEditorProps;
    code: PhoneCountryCode;
    heard: string;
    waiting: { display: string; output: string; country: string };
    adopted: { display: string; output: string };
  }>([
    {
      format: "raw",
      start: { value: "+4600701234567", countryCode: "SE", countries: ["FI", "SE"], international: true },
      code: "FI",
      heard: "+460701234567",
      // With detection on, the held value names SE, so the field shows SE while FI waits.
      waiting: { display: "+4600701234567", output: "+4600701234567", country: "SE" },
      adopted: { display: "+4600701234567", output: "+4600701234567" },
    },
    {
      format: "international",
      start: { value: "+46 7", countryCode: "FI", countries: ["FI", "SE"], autoDetectCountry: false },
      code: "SE",
      heard: "+467",
      waiting: { display: "7", output: "+46 7", country: "SE" },
      adopted: { display: "7", output: "+46 7" },
    },
  ])(
    "keeps a preserved pick waiting under $format output when the parent answers only its country, in every order",
    ({ format, start, code, heard, waiting, adopted }) => {
      const props = { ...start, outputFormat: "e164", preserveOnCountryChange: true } as const;
      const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), code);
      // The parent hears the pick's e164 output, which is not the value it keeps.
      expect(proposedValue(picked)).toBe(heard);
      const formatted = { ...props, outputFormat: format };
      // The format change alone carries the pick into the held value, and it still waits.
      const carried = PhoneEditor.reconcile(picked, formatted);
      expect(PhoneEditor.observeCountry(carried).proposed?.code).toBe(code);
      const echoAnswer = {
        value: heard,
        countryCode: code,
        autoDetectCountry: false,
        outputFormat: format,
      } as const;
      const orders: [string, PhoneEditorState, PhoneEditorProps][] = [
        ["format with the country answer", picked, { ...formatted, countryCode: code }],
        ["format before the country answer", carried, { ...formatted, countryCode: code }],
        ["format with the echo", picked, { ...props, countryCode: code }],
      ];
      for (const [order, from, answer] of orders) {
        const answered = PhoneEditor.reconcile(from, answer);
        expect(PhoneEditor.observeCountry(answered).proposed?.code, order).toBe(code);
        if (answer.outputFormat === format) {
          expect(shown(answered), order).toEqual(waiting);
          // Equal props keep the pick waiting: the held value still answers nothing.
          expect(PhoneEditor.reconcile(answered, answer), order).toBe(answered);
        }
        expect(PhoneEditor.steeredValue(answered), order).toBeNull();
        const accepted = PhoneEditor.reconcile(answered, { ...props, ...echoAnswer });
        expect(PhoneEditor.observeCountry(accepted).proposed, order).toBeNull();
        expect(shown(accepted), order).toEqual({ ...adopted, country: code });
      }
    }
  );

  it("shows a value the parent stores after a countryless answer as its own, not as the pick it heard", () => {
    const props = {
      value: "0701234567",
      countryCode: "NO",
      outputFormat: "e164",
      preserveOnCountryChange: true,
      autoDetectCountry: false,
    } as const;
    const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "SE");
    expect(proposedValue(picked)).toBe("+46701234567");
    // A countryless answer reads the pick again, from the parent's value.
    const halved = PhoneEditor.reconcile(picked, { ...props, value: "070 123 45 67", outputFormat: "raw" });
    expect(PhoneEditor.observeCountry(halved).proposed?.code).toBe("SE");
    const answered = PhoneEditor.reconcile(halved, { ...props, value: "+46701234567", countryCode: "SE" });
    // The parent's answer replaced what the field heard, so the output it heard first is a new value
    // read in SE, with no trunk 0. The pick, read as the countryless answer wrote it, would show
    // "0701234567".
    expect(PhoneEditor.observeCountry(answered).proposed).toBeNull();
    expect(shown(answered)).toEqual({ display: "701234567", output: "+46701234567", country: "SE" });
  });

  it.each<[string, Steps]>([
    ["directly", []],
    ["after the format change alone", [{ outputFormat: "national" }]],
  ])("reads national digits the parent never heard as a new value %s", (_name, between) => {
    // FI is not offered, so the controlled country resolves to SJ, and the paste waits in SJ.
    const props = {
      value: "",
      countryCode: "FI",
      countries: ["SJ"],
      outputFormat: "e164",
      autoDetectCountry: false,
    } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create(props), "+4741234567");
    expect(proposedValue(pasted)).toBe("+4741234567");
    // A national format carries the paste into "41 23 45 67", an output the parent never heard.
    const carried = carryThrough(pasted, props, between);
    expect(PhoneEditor.observeCountry(carried).proposed?.code).toBe("SJ");
    const answered = PhoneEditor.reconcile(carried, {
      ...props,
      value: "41 23 45 67",
      outputFormat: "national",
    });
    // The parent heard "+4741234567". The national form is a new value, read in the shown country
    // and written as the parent wrote it, never the paste's own display.
    expect(PhoneEditor.observeCountry(answered).proposed).toBeNull();
    expect(shown(answered)).toEqual({ display: "41234567", output: "41 23 45 67", country: "SJ" });
    expect(PhoneEditor.steeredValue(answered)).toBeNull();
  });

  it.each<[string, Steps]>([
    ["after the metadata replacement", [{ metadata: withoutNorway }]],
    [
      "after the metadata replacement and then the format change alone",
      [{ metadata: withoutNorway }, { metadata: withoutNorway, outputFormat: "e164" }],
    ],
  ])(
    "adopts a pick the parent echoes after a catalog that drops NO and keeps the controlled SJ, %s",
    (_name, between) => {
      const props = {
        value: "+47 79 12 34 56",
        countryCode: "SJ",
        countries: ["NO", "SJ", "DK"],
        outputFormat: "national",
        preserveOnCountryChange: true,
        autoDetectCountry: false,
      } as const;
      const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "DK");
      const heard = "79 12 34 56";
      expect(proposedValue(picked)).toBe(heard);
      const carried = carryThrough(picked, props, between);
      expect(PhoneEditor.observeCountry(carried).proposed?.code).toBe("DK");
      const accepted = PhoneEditor.reconcile(carried, {
        ...props,
        value: heard,
        countryCode: "DK",
        outputFormat: "e164",
        metadata: withoutNorway,
      });
      // The pick keeps the +47 number it was read as, whichever catalog carried it first.
      expect(PhoneEditor.observeCountry(accepted).proposed).toBeNull();
      expect(shown(accepted)).toEqual({ display: "+4779123456", output: "+4779123456", country: "DK" });
    }
  );

  it.each<[string, Steps]>([
    ["with the metadata restored in the same render", [{ outputFormat: "e164", metadata: maxMetadata }]],
    [
      "after the metadata was restored one render earlier",
      [{ outputFormat: "e164", metadata: maxMetadata }, { outputFormat: "e164" }],
    ],
  ])("adopts a raw paste the parent echoes after a metadata replacement, %s", (_name, between) => {
    const props = {
      value: "",
      countryCode: "AU",
      countries: ["AU"],
      outputFormat: "raw",
      autoDetectCountry: false,
    } as const;
    const pasted = PhoneEditor.paste(PhoneEditor.create(props), "0 0401234567");
    const heard = "0 0401234567";
    expect(proposedValue(pasted)).toBe(heard);
    const carried = carryThrough(pasted, props, between);
    expect(PhoneEditor.observeCountry(carried).proposed?.code).toBe("AU");
    const accepted = PhoneEditor.reconcile(carried, { ...props, value: heard, outputFormat: "e164" });
    // The echo adopts the paste as it was read in the default metadata, with its trunk 0 kept.
    expect(PhoneEditor.observeCountry(accepted).proposed).toBeNull();
    expect(shown(accepted)).toEqual({ display: "00401234567", output: "+610401234567", country: "AU" });
  });

  it.each<[string, Steps]>([
    ["after max metadata and E.164 output in one render", [{ metadata: maxMetadata, outputFormat: "e164" }]],
    [
      "after max metadata, then E.164 output in a separate render",
      [{ metadata: maxMetadata }, { metadata: maxMetadata, outputFormat: "e164" }],
    ],
  ])("reads a first controlled value in the country it comes with, %s", (_name, between) => {
    const props = {
      defaultValue: "011 52 323 555 0130",
      countryCode: "CA",
      countries: ["CA", "US", "MX"],
      outputFormat: "national",
      preserveOnCountryChange: true,
      autoDetectCountry: false,
    } as const;
    // An uncontrolled pick against the controlled CA waits, and tells `onChange` nothing.
    const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "US");
    expect(proposedValue(picked)).toBeNull();
    const carried = carryThrough(picked, props, between);
    expect(PhoneEditor.observeCountry(carried).proposed?.code).toBe("US");
    const answered = PhoneEditor.reconcile(carried, {
      ...props,
      value: "323 555 0130",
      countryCode: "US",
      metadata: maxMetadata,
      outputFormat: "e164",
    });
    expect(PhoneEditor.observeCountry(answered).proposed).toBeNull();
    expect(shown(answered)).toEqual({ display: "3235550130", output: "+13235550130", country: "US" });
  });

  it.each<[string, Steps]>([
    [
      "after the format change, the countryless answer and a metadata replacement in one render",
      [{ outputFormat: "raw", value: "701234567", metadata: seWithoutTrunkPrefix }],
    ],
    [
      "after the format change, then the countryless answer with a metadata replacement",
      [{ outputFormat: "raw" }, { outputFormat: "raw", value: "701234567", metadata: seWithoutTrunkPrefix }],
    ],
  ])("keeps a pick waiting when the parent restates its countryless answer, %s", (_name, between) => {
    const props = {
      value: "+460701234567",
      countryCode: "NO",
      outputFormat: "e164",
      preserveOnCountryChange: true,
      autoDetectCountry: false,
    } as const;
    const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "SE");
    expect(proposedValue(picked)).toBe("+46701234567");
    const carried = carryThrough(picked, props, between);
    expect(PhoneEditor.observeCountry(carried).proposed?.code).toBe("SE");
    const answered = PhoneEditor.reconcile(carried, {
      ...props,
      value: "70 123 45 67",
      outputFormat: "raw",
      metadata: seWithoutTrunkPrefix,
    });
    // A new countryless form of the same number answers the number half again, so the pick waits
    // for its country.
    expect(PhoneEditor.observeCountry(answered).proposed?.code).toBe("SE");
    expect(shown(answered)).toEqual({ display: "701234567", output: "70 123 45 67", country: "NO" });
    expect(PhoneEditor.steeredValue(answered)).toBeNull();
  });
});

// #712: an uncontrolled number under a controlled country. A format change while a pick, paste or
// typed number proposes a country re-formats the shown number without calling `onChange`, so the
// answer compares with the output from before the proposal.
describe("PhoneEditor proposal answers: the notices the editor returns for an uncontrolled number while a country proposal waits", () => {
  type Case = {
    readonly props: PhoneEditorProps;
    readonly propose: (state: PhoneEditorState) => PhoneEditorState;
    readonly answerFormat: PhoneNumberFormat;
    readonly country: PhoneCountryCode;
    readonly output: string;
    readonly steered: string | null;
  };
  it.each<[string, Case]>([
    // The output before the pick is "+4741234567".
    [
      "returns a notice when the confirmed pick changes the output from before the pick",
      {
        props: {
          countryCode: "NO",
          countries: ["NO", "SE"],
          defaultValue: "41234567",
          outputFormat: "e164",
          preserveOnCountryChange: true,
        },
        propose: (state) => PhoneEditor.selectCountry(state, "SE"),
        answerFormat: "raw",
        country: "SE",
        output: "41234567",
        steered: "41234567",
      },
    ],
    // The output before the paste is "070-123 45 67". The format change shows "0701234567" in NO.
    [
      "returns no notice when the confirmed paste shows the output from before the paste",
      {
        props: {
          countryCode: "NO",
          countries: ["NO", "SE"],
          defaultValue: "070-123 45 67",
          outputFormat: "raw",
          preserveOnCountryChange: true,
        },
        propose: (state) => PhoneEditor.paste(state, "+46701234567"),
        answerFormat: "national",
        country: "SE",
        output: "070-123 45 67",
        steered: null,
      },
    ],
    // Typing the international prefix proposes SE. The output before it is "+47701234567".
    [
      "returns a notice when the confirmed typed number changes the output from before it",
      {
        props: {
          countryCode: "NO",
          countries: ["NO", "SE"],
          defaultValue: "701234567",
          outputFormat: "e164",
          preserveOnCountryChange: true,
        },
        propose: (state) => fill(state, "+46701234567"),
        answerFormat: "raw",
        country: "SE",
        output: "701234567",
        steered: "701234567",
      },
    ],
  ])(
    "%s, after a format change while it waits",
    (_name, { props, propose, answerFormat, country, output, steered }) => {
      const carried = PhoneEditor.reconcile(propose(PhoneEditor.create(props)), {
        ...props,
        outputFormat: answerFormat,
      });
      expect(PhoneEditor.observeCountry(carried).proposed?.code).toBe(country);
      const accepted = PhoneEditor.reconcile(carried, {
        ...props,
        outputFormat: answerFormat,
        countryCode: country,
      });
      expect(PhoneEditor.observeCountry(accepted).proposed).toBeNull();
      expect(shown(accepted).output).toBe(output);
      expect(PhoneEditor.steeredValue(accepted)?.value ?? null).toBe(steered);
    }
  );

  // A change that answers nothing about the waiting pick compares with the output the field shows.
  // Each row starts in one format and switches to the other while the pick waits.
  const outputIn = { e164: "+4741234567", raw: "41234567" } as const;
  it.each<[string, "e164" | "raw", Partial<PhoneEditorProps>, PhoneCountryCode, string, string | null]>([
    [
      "returns a notice when a fallback restores the format",
      "e164",
      { countries: ["SJ"], outputFormat: "e164" },
      "SJ",
      "+4741234567",
      "+4741234567",
    ],
    [
      "returns no notice when a fallback that still offers the pick's country keeps the shown output",
      "e164",
      { countries: ["SE", "DK"] },
      "DK",
      "41234567",
      null,
    ],
    [
      "returns no notice when a new country in a catalog without the pick's keeps the shown output",
      "e164",
      { countryCode: "SJ", countries: ["NO", "SJ"] },
      "SJ",
      "41234567",
      null,
    ],
    [
      "returns no notice when a new code falls back where the old one does and keeps the shown output",
      "e164",
      { countryCode: "GB", countries: ["DK", "SE"] },
      "DK",
      "41234567",
      null,
    ],
    [
      "returns a notice when a new code falls back where the old one does and changes the shown output",
      "raw",
      { countryCode: "GB", countries: ["DK", "SE"], outputFormat: "raw" },
      "DK",
      "41234567",
      "41234567",
    ],
  ])("%s, after a format change while a pick waits", (_name, format, change, country, output, steered) => {
    const carriedFormat = format === "e164" ? "raw" : "e164";
    const props = {
      countryCode: "NO",
      countries: ["NO", "SE", "SJ"],
      defaultValue: "41234567",
      outputFormat: format,
      preserveOnCountryChange: true,
    } as const;
    const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "SE");
    const carried = PhoneEditor.reconcile(picked, { ...props, outputFormat: carriedFormat });
    expect(shown(carried).output).toBe(outputIn[carriedFormat]);
    const moved = PhoneEditor.reconcile(carried, { ...props, outputFormat: carriedFormat, ...change });
    expect(PhoneEditor.observeCountry(moved).proposed).toBeNull();
    expect(shown(moved).country).toBe(country);
    expect(shown(moved).output).toBe(output);
    expect(PhoneEditor.steeredValue(moved)?.value ?? null).toBe(steered);
  });

  // Releasing `countryCode` answers nothing about the waiting pick, so the notice compares with the
  // output the field shows. Narrowing `countries` to the pick's country shows the pick.
  it.each<[string, PhoneNumberFormat, PhoneNumberFormat, string | null]>([
    ["returns no notice when the release keeps the shown output", "e164", "raw", null],
    ["returns a notice when the release restores the format from before the pick", "raw", "e164", "41234567"],
  ])("%s, after a format change while a pick waits", (_name, format, carriedFormat, steered) => {
    const props = {
      countryCode: "NO",
      countries: ["NO", "SE"],
      defaultValue: "41234567",
      outputFormat: format,
      preserveOnCountryChange: true,
    } as const;
    const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "SE");
    const carried = PhoneEditor.reconcile(picked, { ...props, outputFormat: carriedFormat });
    expect(PhoneEditor.observeCountry(carried).proposed?.code).toBe("SE");
    const { countryCode: _released, ...uncontrolled } = props;
    const released = PhoneEditor.reconcile(carried, {
      ...uncontrolled,
      outputFormat: "raw",
      countries: ["SE"],
    });
    expect(PhoneEditor.observeCountry(released).proposed).toBeNull();
    expect(shown(released)).toEqual({ display: "41234567", output: "41234567", country: "SE" });
    expect(PhoneEditor.steeredValue(released)?.value ?? null).toBe(steered);
  });

  // #712, case 2. Before #710 the accepted pick showed "+4402012345678" with the output
  // "+44 (0)20 1234 5678", and the editor returned no notice.
  it("shows and returns a notice for the number the full catalog reads once the parent sets the pick's country after a metadata replacement", () => {
    const props = {
      countryCode: "NO",
      countries: ["NO", "SJ", "GB"],
      defaultValue: "+44 (0)20 1234 5678",
      outputFormat: "raw",
      preserveOnCountryChange: true,
    } as const;
    const picked = PhoneEditor.selectCountry(PhoneEditor.create(props), "SJ");
    const carried = PhoneEditor.reconcile(picked, { ...props, metadata: maxMetadata });
    const accepted = PhoneEditor.reconcile(carried, { ...props, metadata: maxMetadata, countryCode: "SJ" });
    expect(PhoneEditor.observeCountry(accepted).proposed).toBeNull();
    expect(shown(accepted)).toEqual({ display: "+442012345678", output: "+442012345678", country: "SJ" });
    expect(PhoneEditor.steeredValue(accepted)?.value).toBe("+442012345678");
  });
});
