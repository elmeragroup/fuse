import type { MetadataJson } from "libphonenumber-js/core";
import { describe, expect, it } from "vitest";

import { defaultMetadata, getCountries, resolveSelectedCountry } from "./phone-engine";
import { receiveValue, reconcile, snapshot } from "./phone-field-state";
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

  it("re-reads authoritative controlled raw digits under a replaced catalog", () => {
    const before = configure(defaultMetadata, { outputFormat: "raw" });
    const stored = stateWith(before, "41234567", "");
    const next = reconcile(stored, "41234567", configure(swedishMetadata, { outputFormat: "raw" }));
    expect(next.accepted.country.code).toBe("SE");
    expect(next.accepted.digits).toBe("41234567");
    expect(next.accepted.values.outputValue).toBe("41234567");
  });
});
