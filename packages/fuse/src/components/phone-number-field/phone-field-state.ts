import type { CountryCode, MetadataJson } from "libphonenumber-js/core";

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
      parsedNational: next.parsedNational,
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
 * Native form reset for an uncontrolled field, with no proposal. A default number, `""`
 * included, is read again as on mount, in the default country and under the current
 * configuration, so a later formatting or catalog change shows in it. Without one, the
 * digits empty and the visible country stays. The hook calls it only while it owns the value.
 */
export function resetToDefault(
  stored: PhoneState,
  defaultValue: string | undefined,
  defaultCountryCode: CountryCode | undefined
): PhoneState {
  const { configuration } = stored;
  return {
    ...stored,
    accepted:
      defaultValue !== undefined
        ? receiveValue(
            defaultValue,
            resolveSelectedCountry(configuration.countries, defaultCountryCode),
            configuration
          )
        : snapshot({ digits: "", country: visibleSnapshot(stored).country }, configuration),
    proposal: null,
  };
}

/**
 * Whether a number shown in `country` must be read again for a new configuration: its
 * metadata was replaced, or the picker no longer offers its country. A list that only gains
 * or loses other countries keeps the number as entered.
 */
function catalogReplaced(
  from: PhoneConfiguration,
  to: PhoneConfiguration,
  country: PhoneNumberCountry
): boolean {
  return from.metadata !== to.metadata || !to.countries.some((row) => row.code === country.code);
}

/**
 * Fold new props into the stored record. An echoed proposal becomes the accepted snapshot;
 * a formatting-only change re-derives values from the existing digits; a catalog
 * replacement, of the metadata or of the picker countries, preserves the number's
 * international identity.
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
  const replaced = catalogReplaced(stored.configuration, configuration, previous.country);
  let accepted: PhoneSnapshot;
  if (value !== undefined && stored.value !== value && !echoedProposal) {
    accepted = receiveValue(value, country, configuration);
  } else if (value !== undefined && replaced) {
    // A controlled value the parent kept: its number reads again by its international form,
    // which keeps the number's identity, unless the field was submitting `value` and that
    // would change it. A `raw` value carries no country, so it then reads again as itself in
    // the country that remains.
    const kept = reformat(previous, country, stored.configuration, configuration, true);
    accepted =
      kept.values.outputValue === value || previous.values.outputValue !== value
        ? kept
        : receiveValue(value, country, configuration);
  } else {
    accepted = reformat(previous, country, stored.configuration, configuration, replaced);
  }
  return { configuration, value, accepted, proposal: null };
}

function reformat(
  previous: PhoneSnapshot,
  country: PhoneNumberCountry,
  from: PhoneConfiguration,
  to: PhoneConfiguration,
  replaced: boolean
): PhoneSnapshot {
  if (!replaced) {
    return snapshot({ digits: previous.digits, country, parsedNational: previous.parsedNational }, to);
  }
  // Catalog replacement keeps the existing number's international identity. An
  // unsupported prefix remains visible instead of being reinterpreted in the new country.
  return receiveValue(toInternationalInput(previous, from.metadata), country, to);
}
