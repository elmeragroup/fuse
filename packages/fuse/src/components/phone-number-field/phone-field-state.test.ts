import type { MetadataJson } from "libphonenumber-js/core";
import { describe, expect, it } from "vitest";

import { defaultMetadata, getCountries, resolveSelectedCountry } from "./phone-engine";
import { receiveValue, reconcile, resetToDefault, snapshot } from "./phone-field-state";
import type { PhoneConfiguration, PhoneState } from "./phone-field-state";

const swedishMetadata: MetadataJson = {
  ...defaultMetadata,
  countries: { SE: defaultMetadata.countries.SE },
  country_calling_codes: { "46": ["SE"] },
};

function configure(metadata: MetadataJson, overrides: Partial<PhoneConfiguration> = {}): PhoneConfiguration {
  return {
    countries: getCountries(metadata),
    metadata,
    autoDetectCountry: true,
    international: false,
    outputFormat: "e164",
    formatOnType: false,
    ...overrides,
  };
}

function stateWith(configuration: PhoneConfiguration, value: string | undefined, digits: string): PhoneState {
  const norway = resolveSelectedCountry(configuration.countries, "NO");
  return {
    configuration,
    value,
    accepted: receiveValue(value ?? "", norway, configuration),
    proposal: digits ? snapshot({ digits, country: norway }, configuration) : null,
  };
}

describe("reconcile", () => {
  it("reads an external replacement even when configuration changes in the same transition", () => {
    const before = configure(defaultMetadata, { international: true });
    const stored = stateWith(before, "", "41234567");
    const next = reconcile(
      stored,
      "+4799999999",
      configure(defaultMetadata, {
        international: true,
        autoDetectCountry: false,
      })
    );
    expect(next.accepted.digits).toBe("+4799999999");
    expect(next.accepted.values.outputValue).toBe("+4799999999");
  });

  it("re-reads a replaced controlled value with the visible country", () => {
    const configuration = configure(defaultMetadata);
    const stored = stateWith(configuration, "", "");
    const next = reconcile(stored, "+46701234567", configuration);
    expect(next.accepted.country.code).toBe("SE");
    expect(next.accepted.digits).toBe("701234567");
    expect(next.accepted.values.outputValue).toBe("+46701234567");
  });

  it("keeps national digits national when detection is off and display formatting toggles", () => {
    const before = configure(defaultMetadata, { autoDetectCountry: false });
    const stored = stateWith(before, undefined, "41234567");
    const next = reconcile(
      stored,
      undefined,
      configure(defaultMetadata, { autoDetectCountry: false, formatOnType: true })
    );
    expect(next.accepted.digits).toBe("41234567");
    expect(next.accepted.values.displayValue).toBe("41 23 45 67");
    expect(next.accepted.values.outputValue).toBe("+4741234567");
  });

  it("keeps a typed international prefix through a formatting change", () => {
    const before = configure(defaultMetadata, { international: true });
    const stored = stateWith(before, undefined, "+4741234567");
    const next = reconcile(
      stored,
      undefined,
      configure(defaultMetadata, { international: true, outputFormat: "national" })
    );
    expect(next.accepted.digits).toBe("+4741234567");
    expect(next.accepted.values.outputValue).toBe("41 23 45 67");
  });

  it("keeps the national format of a detected number when formatOnType turns on", () => {
    const before = configure(defaultMetadata);
    const norway = resolveSelectedCountry(before.countries, "NO");
    const stored: PhoneState = {
      configuration: before,
      value: undefined,
      accepted: receiveValue("+46701234567", norway, before),
      proposal: null,
    };
    expect(stored.accepted.values.displayValue).toBe("701234567");
    const next = reconcile(stored, undefined, configure(defaultMetadata, { formatOnType: true }));
    expect(next.accepted.country.code).toBe("SE");
    expect(next.accepted.values).toEqual({ displayValue: "070-123 45 67", outputValue: "+46701234567" });
  });

  it("keeps a number's identity when the picker countries drop its country", () => {
    const before = configure(defaultMetadata, { countries: getCountries(defaultMetadata, ["NO", "SE"]) });
    const stored: PhoneState = {
      configuration: before,
      value: undefined,
      accepted: receiveValue("+46701234567", resolveSelectedCountry(before.countries, "NO"), before),
      proposal: null,
    };
    expect(stored.accepted.country.code).toBe("SE");
    const next = reconcile(
      stored,
      undefined,
      configure(defaultMetadata, { countries: getCountries(defaultMetadata, ["NO"]) })
    );
    expect(next.accepted.country.code).toBe("NO");
    expect(next.accepted.values).toEqual({ displayValue: "+46701234567", outputValue: "+46701234567" });
  });

  it.each([
    ["gains", ["NO", "SE", "FI"]],
    ["loses", ["SE"]],
  ] as const)("keeps national drafts as typed when the picker %s other countries", (_change, after) => {
    const before = configure(defaultMetadata, { countries: getCountries(defaultMetadata, ["NO", "SE"]) });
    const sweden = resolveSelectedCountry(before.countries, "SE");
    const next = configure(defaultMetadata, { countries: getCountries(defaultMetadata, after) });
    const typed: PhoneState = {
      configuration: before,
      value: undefined,
      accepted: snapshot({ digits: "0701234567", country: sweden }, before),
      proposal: null,
    };
    // A catalog replacement would re-read it through its E.164 form as "701234567".
    expect(reconcile(typed, undefined, next).accepted.digits).toBe("0701234567");
    // A controlled draft too short to submit: the parent holds "", and the draft stays shown.
    const partial = snapshot({ digits: "0", country: sweden }, before);
    expect(partial.values.outputValue).toBe("");
    const draft: PhoneState = { configuration: before, value: "", accepted: partial, proposal: null };
    expect(reconcile(draft, "", next).accepted.values.displayValue).toBe("0");
  });

  it.each([
    // Anguilla dials seven-digit local numbers, which take its 264 area code.
    ["AI", "2351234", "+12642351234"],
    // Kazakhstan's trunk prefix is 8.
    ["KZ", "87011234567", "+77011234567"],
  ] as const)(
    "re-reads a %s draft by its own rules when its country leaves the picker",
    (code, digits, e164) => {
      const before = configure(defaultMetadata, { countries: getCountries(defaultMetadata, [code, "NO"]) });
      const stored: PhoneState = {
        configuration: before,
        value: undefined,
        accepted: snapshot({ digits, country: resolveSelectedCountry(before.countries, code) }, before),
        proposal: null,
      };
      expect(stored.accepted.values.outputValue).toBe(e164);
      const next = reconcile(
        stored,
        undefined,
        configure(defaultMetadata, { countries: getCountries(defaultMetadata, ["NO"]) })
      );
      expect(next.accepted.country.code).toBe("NO");
      expect(next.accepted.values).toEqual({ displayValue: e164, outputValue: e164 });
    }
  );

  it.each([
    // The national format names no country, but the number still yields the parent's value.
    ["national", "070-123 45 67", { displayValue: "+46701234567", outputValue: "070-123 45 67" }, "NO"],
    // Raw digits name no country, so they read again as themselves in the one that remains.
    ["raw", "0701234567", { displayValue: "0701234567", outputValue: "0701234567" }, "NO"],
  ] as const)(
    "keeps a controlled %s value the parent kept when its country leaves the picker",
    (outputFormat, value, values, country) => {
      const before = configure(defaultMetadata, {
        outputFormat,
        countries: getCountries(defaultMetadata, ["SE", "NO"]),
      });
      const sweden = resolveSelectedCountry(before.countries, "SE");
      const accepted = snapshot({ digits: "0701234567", country: sweden }, before);
      expect(accepted.values.outputValue).toBe(value);
      const next = reconcile(
        { configuration: before, value, accepted, proposal: null },
        value,
        configure(defaultMetadata, { outputFormat, countries: getCountries(defaultMetadata, ["NO"]) })
      );
      expect(next.accepted.country.code).toBe(country);
      expect(next.accepted.values).toEqual(values);
    }
  );

  it.each([
    ["e164", "+46701234567"],
    ["international", "+46 70 123 45 67"],
    ["national", "070-123 45 67"],
  ] as const)(
    "keeps a controlled number the parent gave in another form when its country leaves the picker, %s",
    (outputFormat, submits) => {
      const before = configure(defaultMetadata, {
        outputFormat,
        countries: getCountries(defaultMetadata, ["SE", "NO"]),
      });
      const sweden = resolveSelectedCountry(before.countries, "SE");
      const value = "0701234567";
      const stored: PhoneState = {
        configuration: before,
        value,
        accepted: receiveValue(value, sweden, before),
        proposal: null,
      };
      expect(stored.accepted.values.outputValue).toBe(submits);
      const next = reconcile(
        stored,
        value,
        configure(defaultMetadata, { outputFormat, countries: getCountries(defaultMetadata, ["NO"]) })
      );
      expect(next.accepted.values.outputValue).toBe(submits);
    }
  );

  it("empties a draft that holds no number yet when its country leaves the picker", () => {
    const before = configure(defaultMetadata, { countries: getCountries(defaultMetadata, ["SE", "NO"]) });
    const stored: PhoneState = {
      configuration: before,
      value: undefined,
      accepted: snapshot({ digits: "0", country: resolveSelectedCountry(before.countries, "SE") }, before),
      proposal: null,
    };
    const next = reconcile(
      stored,
      undefined,
      configure(defaultMetadata, { countries: getCountries(defaultMetadata, ["NO"]) })
    );
    expect(next.accepted.values).toEqual({ displayValue: "", outputValue: "" });
  });

  it("re-reads authoritative controlled raw digits under a replaced catalog", () => {
    const before = configure(defaultMetadata, { outputFormat: "raw" });
    const stored = stateWith(before, "41234567", "");
    const next = reconcile(stored, "41234567", configure(swedishMetadata, { outputFormat: "raw" }));
    expect(next.accepted.country.code).toBe("SE");
    expect(next.accepted.digits).toBe("41234567");
    expect(next.accepted.values.outputValue).toBe("41234567");
  });
});

describe("resetToDefault", () => {
  // An edit in Sweden, proposed over an empty Norwegian field.
  function editedInSweden(configuration: PhoneConfiguration): PhoneState {
    const norway = resolveSelectedCountry(configuration.countries, "NO");
    const sweden = resolveSelectedCountry(configuration.countries, "SE");
    return {
      configuration,
      value: undefined,
      accepted: receiveValue("", norway, configuration),
      proposal: snapshot({ digits: "701234567", country: sweden }, configuration),
    };
  }

  it("reads the default again under the configuration the field has now", () => {
    const reset = resetToDefault(
      editedInSweden(configure(defaultMetadata, { formatOnType: true })),
      "+4741234567",
      "NO"
    );
    expect(reset.proposal).toBeNull();
    expect(reset.accepted.country.code).toBe("NO");
    expect(reset.accepted.values).toEqual({ displayValue: "41 23 45 67", outputValue: "+4741234567" });
  });

  it("restores an empty default in the default country", () => {
    const reset = resetToDefault(editedInSweden(configure(defaultMetadata)), "", "NO");
    expect(reset.proposal).toBeNull();
    expect(reset.accepted.country.code).toBe("NO");
    expect(reset.accepted.values).toEqual({ displayValue: "", outputValue: "" });
  });

  it("clears the digits and keeps the visible country without a default", () => {
    const reset = resetToDefault(editedInSweden(configure(defaultMetadata)), undefined, "NO");
    expect(reset.proposal).toBeNull();
    expect(reset.accepted.country.code).toBe("SE");
    expect(reset.accepted.values).toEqual({ displayValue: "", outputValue: "" });
  });
});
