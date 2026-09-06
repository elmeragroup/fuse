import type { MetadataJson } from "libphonenumber-js/core";

import {
  cleanPhoneInput,
  processInputWithDetection,
  resolvePhoneFieldValues,
  resolveSelectedCountry,
  toInternationalInput,
} from "./phone-engine";
import type {
  PhoneFieldValues,
  PhoneNumberCountry,
  PhoneNumberFormat,
  ProcessedPhoneInput,
} from "./phone-engine";

/**
 * Pure state transitions for `usePhoneNumberFieldState`.
 * Parsed values belong to immutable snapshots; the hook only decides when to call these.
 */

export type PhoneSnapshot = ProcessedPhoneInput & { values: PhoneFieldValues };

export type PhoneConfiguration = {
  countries: PhoneNumberCountry[];
  metadata: MetadataJson;
  autoDetectCountry: boolean;
  international: boolean;
  outputFormat: PhoneNumberFormat;
  formatOnType: boolean;
};

export type PhoneState = {
  configuration: PhoneConfiguration;
  value: string | undefined;
  accepted: PhoneSnapshot;
  proposal: PhoneSnapshot | null;
};

function decodeFieldValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function snapshot(next: ProcessedPhoneInput, configuration: PhoneConfiguration): PhoneSnapshot {
  return {
    ...next,
    values: resolvePhoneFieldValues({
      ...configuration,
      digits: next.digits,
      country: next.country.code,
    }),
  };
}

export function receiveValue(
  input: string,
  country: PhoneNumberCountry,
  configuration: PhoneConfiguration
): PhoneSnapshot {
  return snapshot(
    processInputWithDetection({
      ...configuration,
      input: cleanPhoneInput(decodeFieldValue(input)),
      currentCountry: country,
    }),
    configuration
  );
}

/** A proposed edit stays visible only while the parent has not rejected its output. */
export function visibleSnapshot({ value, accepted, proposal }: PhoneState): PhoneSnapshot {
  return proposal && (value === undefined || proposal.values.outputValue === value) ? proposal : accepted;
}

/**
 * Fold new props into the stored record. An echoed proposal becomes the accepted snapshot;
 * a formatting-only change re-derives values from the existing digits; a catalog
 * replacement preserves the number's international identity.
 */
export function reconcile(
  stored: PhoneState,
  value: string | undefined,
  configuration: PhoneConfiguration
): PhoneState {
  const sameConfiguration = stored.configuration === configuration;
  if (sameConfiguration && stored.value === value) {
    return stored;
  }
  if (sameConfiguration && stored.proposal && stored.proposal.values.outputValue === value) {
    return { configuration, value, accepted: stored.proposal, proposal: null };
  }
  const echoedProposal = stored.proposal?.values.outputValue === value ? stored.proposal : null;
  const previous = echoedProposal ?? visibleSnapshot(stored);
  const country = resolveSelectedCountry(configuration.countries, previous.country.code);
  const accepted =
    value !== undefined &&
    (stored.configuration.metadata !== configuration.metadata || (stored.value !== value && !echoedProposal))
      ? receiveValue(value, country, configuration)
      : reformat(previous, country, stored.configuration, configuration);
  return { configuration, value, accepted, proposal: null };
}

function reformat(
  previous: PhoneSnapshot,
  country: PhoneNumberCountry,
  from: PhoneConfiguration,
  to: PhoneConfiguration
): PhoneSnapshot {
  if (from.metadata === to.metadata) {
    return snapshot({ digits: previous.digits, country }, to);
  }
  // Catalog replacement keeps the existing number's international identity. An
  // unsupported prefix remains visible instead of being reinterpreted in the new country.
  return receiveValue(toInternationalInput(previous), country, to);
}
