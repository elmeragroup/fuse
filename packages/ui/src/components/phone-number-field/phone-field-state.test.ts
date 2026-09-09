import type { MetadataJson } from "libphonenumber-js/core";
import { describe, expect, it } from "vitest";

import { defaultMetadata, getCountries, resolveSelectedCountry } from "./phone-engine";
import type { PhoneNumberCountry } from "./phone-engine";
import { clearedForReset, receiveValue, reconcile, snapshot, visibleSnapshot } from "./phone-field-state";
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

function country(configuration: PhoneConfiguration, code: string): PhoneNumberCountry {
  const match = configuration.countries.find((row) => row.code === code);
  if (!match) throw new Error(`Missing ${code}`);
  return match;
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

describe("visibleSnapshot", () => {
  it("shows the proposal while the field is uncontrolled", () => {
    const state = stateWith(configure(defaultMetadata), undefined, "41234567");
    expect(visibleSnapshot(state)).toBe(state.proposal);
  });

  it("shows the proposal only when the parent accepted its output", () => {
    const configuration = configure(defaultMetadata);
    const accepted = stateWith(configuration, "+4741234567", "41234567");
    const rejected = stateWith(configuration, "+4799999999", "41234567");
    expect(visibleSnapshot(accepted)).toBe(accepted.proposal);
    expect(visibleSnapshot(rejected)).toBe(rejected.accepted);
  });
});

describe("reconcile", () => {
  it("returns the stored record when nothing changed", () => {
    const configuration = configure(defaultMetadata);
    const stored = stateWith(configuration, undefined, "41234567");
    expect(reconcile(stored, undefined, configuration)).toBe(stored);
  });

  it("promotes the proposal when the parent echoes its output", () => {
    const configuration = configure(defaultMetadata);
    const stored = stateWith(configuration, "", "41234567");
    const next = reconcile(stored, "+4741234567", configuration);
    expect(next.accepted).toBe(stored.proposal);
    expect(next.proposal).toBeNull();
    expect(next.value).toBe("+4741234567");
  });

  it.each([false, true])(
    "preserves a controlled national draft across configuration changes, newly accepted: %s",
    (newlyAccepted) => {
      const before = configure(defaultMetadata, { international: true });
      const proposed = stateWith(before, "", "41234567");
      const stored = newlyAccepted ? proposed : reconcile(proposed, "+4741234567", before);
      const next = reconcile(
        stored,
        "+4741234567",
        configure(defaultMetadata, {
          international: true,
          autoDetectCountry: false,
        })
      );
      expect(next.accepted.digits).toBe("41234567");
      expect(next.accepted.values.displayValue).toBe("41234567");
      expect(next.accepted.values.outputValue).toBe("+4741234567");
      expect(next.proposal).toBeNull();
    }
  );

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

  it("reformats an uncontrolled international draft when only the output format changes", () => {
    const before = configure(defaultMetadata, { international: true });
    const stored = stateWith(before, undefined, "41234567");
    const next = reconcile(
      stored,
      undefined,
      configure(defaultMetadata, { international: true, outputFormat: "raw" })
    );
    expect(next.accepted.digits).toBe("41234567");
    expect(next.accepted.values.displayValue).toBe("41234567");
    expect(next.accepted.values.outputValue).toBe("41234567");
    expect(next.accepted.country.code).toBe("NO");
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

  it("migrates an uncontrolled national number to its international identity on catalog replacement", () => {
    const stored = stateWith(configure(defaultMetadata), undefined, "41234567");
    const swedish = configure(swedishMetadata);
    const next = reconcile(stored, undefined, swedish);
    expect(next.accepted.country).toEqual(country(swedish, "SE"));
    expect(next.accepted.digits).toBe("+4741234567");
    expect(next.accepted.values.displayValue).toBe("+4741234567");
    expect(next.accepted.values.outputValue).toBe("+4741234567");
  });

  it("keeps an empty uncontrolled field empty on catalog replacement", () => {
    const stored = stateWith(configure(defaultMetadata), undefined, "");
    const next = reconcile(stored, undefined, configure(swedishMetadata));
    expect(next.accepted.digits).toBe("");
    expect(next.accepted.values.outputValue).toBe("");
    expect(next.accepted.country.code).toBe("SE");
  });

  it("re-reads authoritative controlled raw digits under a replaced catalog", () => {
    const before = configure(defaultMetadata, { outputFormat: "raw" });
    const stored = stateWith(before, "41234567", "");
    const next = reconcile(stored, "41234567", configure(swedishMetadata, { outputFormat: "raw" }));
    expect(next.accepted.country.code).toBe("SE");
    expect(next.accepted.digits).toBe("41234567");
    expect(next.accepted.values.outputValue).toBe("41234567");
  });

  it("re-reads a controlled value under a replaced catalog", () => {
    const stored = stateWith(configure(defaultMetadata), "+4741234567", "");
    const next = reconcile(stored, "+4741234567", configure(swedishMetadata));
    expect(next.accepted.country.code).toBe("SE");
    expect(next.accepted.values.displayValue).toBe("+4741234567");
    expect(next.accepted.values.outputValue).toBe("+4741234567");
  });
});

describe("clearedForReset", () => {
  it("clears digits and the proposal while keeping the visible country", () => {
    const configuration = configure(defaultMetadata);
    const stored = stateWith(configuration, undefined, "41234567");
    const next = clearedForReset(stored);
    expect(next.accepted.digits).toBe("");
    expect(next.accepted.country).toBe(visibleSnapshot(stored).country);
    expect(next.proposal).toBeNull();
    expect(next.value).toBeUndefined();
    expect(next.configuration).toBe(configuration);
  });

  it("is a no-op when the value is parent-owned", () => {
    const stored = stateWith(configure(defaultMetadata), "+4741234567", "41234567");
    expect(clearedForReset(stored)).toBe(stored);
  });
});
