"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent } from "react";

import type { CountryCode, MetadataJson } from "libphonenumber-js/core";

import { countryNameResolver } from "../country-names";
import {
  cleanPhoneInput,
  defaultMetadata,
  getCountries,
  processInputWithDetection,
  requirePickerCountries,
  resolvePhoneFieldValues,
  resolveSelectedCountry,
} from "../phone-engine";
import type {
  PhoneCountryCode,
  PhoneFieldValues,
  PhoneNumberCountry,
  PhoneNumberFormat,
  ProcessedPhoneInput,
} from "../phone-engine";

export type UsePhoneNumberFieldStateOptions = {
  value?: string;
  onChange?: (value: string) => void;
  defaultCountryCode?: PhoneCountryCode;
  metadata?: MetadataJson;
  autoDetectCountry?: boolean;
  international?: boolean;
  preserveOnCountryChange?: boolean;
  outputFormat?: PhoneNumberFormat;
  formatOnType?: boolean;
  onCountryChange?: (country: PhoneNumberCountry) => void;
  locale: string;
};

export type UsePhoneNumberFieldStateReturn = {
  displayValue: string;
  outputValue: string;
  handleInputChange: (value: string) => void;
  selectCountry: (code: CountryCode | undefined) => void;
  handlePaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  selectedCountry: PhoneNumberCountry;
  countries: PhoneNumberCountry[];
  getCountryName: (countryCode: CountryCode) => string;
};

function decodeFieldValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type PhoneSnapshot = ProcessedPhoneInput & { values: PhoneFieldValues };

type PhoneConfiguration = {
  countries: PhoneNumberCountry[];
  metadata: MetadataJson;
  autoDetectCountry: boolean;
  international: boolean;
  outputFormat: PhoneNumberFormat;
  formatOnType: boolean;
};

type PhoneState = {
  configuration: PhoneConfiguration;
  value: string | undefined;
  accepted: PhoneSnapshot;
  proposal: PhoneSnapshot | null;
};

function snapshot(next: ProcessedPhoneInput, configuration: PhoneConfiguration): PhoneSnapshot {
  return {
    ...next,
    values: resolvePhoneFieldValues({
      ...configuration,
      digits: next.digits,
      country: next.country.code,
    }),
  };
}

function receiveValue(input: string, country: PhoneNumberCountry, configuration: PhoneConfiguration) {
  return snapshot(
    processInputWithDetection({
      ...configuration,
      input: cleanPhoneInput(decodeFieldValue(input)),
      currentCountry: country,
    }),
    configuration
  );
}

export function usePhoneNumberFieldState({
  value,
  onChange,
  defaultCountryCode,
  metadata = defaultMetadata,
  autoDetectCountry = true,
  international = false,
  preserveOnCountryChange = false,
  outputFormat = "e164",
  formatOnType = false,
  onCountryChange,
  locale,
}: UsePhoneNumberFieldStateOptions): UsePhoneNumberFieldStateReturn {
  const countries = useMemo(() => requirePickerCountries(getCountries(metadata)), [metadata]);
  const configuration = useMemo(
    () => ({
      countries,
      metadata,
      autoDetectCountry,
      international,
      outputFormat,
      formatOnType,
    }),
    [countries, metadata, autoDetectCountry, international, outputFormat, formatOnType]
  );
  const [stored, setState] = useState<PhoneState>(() => ({
    configuration,
    value,
    accepted: receiveValue(value ?? "", resolveSelectedCountry(countries, defaultCountryCode), configuration),
    proposal: null,
  }));

  // Parsed values belong to immutable snapshots. A proposed edit is reusable only when
  // the parent accepts its output; an unchanged prop keeps the accepted snapshot visible.
  let state = stored;
  if (stored.configuration !== configuration || stored.value !== value) {
    const previous =
      stored.proposal && (stored.value === undefined || stored.proposal.values.outputValue === stored.value)
        ? stored.proposal
        : stored.accepted;
    const country = resolveSelectedCountry(countries, previous.country.code);
    const acceptedEcho =
      stored.configuration === configuration && stored.proposal?.values.outputValue === value;
    // Catalog replacement preserves the existing number's international identity. An
    // unsupported prefix remains visible instead of being reinterpreted in the new country.
    const existingInput =
      previous.digits && !previous.digits.startsWith("+")
        ? previous.country.dialCode + previous.digits
        : previous.digits;
    const accepted =
      acceptedEcho && stored.proposal
        ? stored.proposal
        : receiveValue(value ?? existingInput, country, configuration);
    state = { configuration, value, accepted, proposal: null };
    setState(state);
  }
  const current =
    state.proposal && (value === undefined || state.proposal.values.outputValue === value)
      ? state.proposal
      : state.accepted;
  const { digits, country: selectedCountry, values } = current;

  // Notify only committed country changes, including external value/catalog replacement.
  const notifiedCountry = useRef(selectedCountry.code);
  useEffect(() => {
    if (notifiedCountry.current !== selectedCountry.code) {
      notifiedCountry.current = selectedCountry.code;
      onCountryChange?.(selectedCountry);
    }
  }, [selectedCountry, onCountryChange]);

  const propose = (next: ProcessedPhoneInput) => {
    const proposal = snapshot(next, configuration);
    setState({ ...state, accepted: current, proposal });
    onChange?.(proposal.values.outputValue);
  };

  const handleInputChange = (input: string) => {
    propose(
      processInputWithDetection({
        ...configuration,
        input: cleanPhoneInput(input),
        currentCountry: selectedCountry,
      })
    );
  };

  const selectCountry = (code: CountryCode | undefined) => {
    if (!code || code === selectedCountry.code) return;
    const country = countries.find((row) => row.code === code);
    if (country) propose({ digits: preserveOnCountryChange ? digits : "", country });
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    handleInputChange(event.clipboardData.getData("text"));
  };

  const getCountryName = useMemo(() => countryNameResolver(locale), [locale]);
  return {
    ...values,
    handleInputChange,
    selectCountry,
    handlePaste,
    selectedCountry,
    countries,
    getCountryName,
  };
}
