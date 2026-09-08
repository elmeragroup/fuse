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
  resolveSelectedCountry,
} from "../phone-engine";
import type {
  PhoneCountryCode,
  PhoneNumberCountry,
  PhoneNumberFormat,
  ProcessedPhoneInput,
} from "../phone-engine";
import { receiveValue, reconcile, snapshot, visibleSnapshot } from "../phone-field-state";
import type { PhoneState } from "../phone-field-state";

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
  resetUncontrolled: () => void;
};

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

  // Props are folded in during render so external replacement is visible in the same
  // pass, including server rendering. The store catches up on commit.
  const state = reconcile(stored, value, configuration);
  if (state !== stored) setState(state);
  const current = visibleSnapshot(state);
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

  const resetUncontrolled = () => {
    setState((previous) => {
      if (previous.value !== undefined) return previous;
      const { country } = visibleSnapshot(previous);
      return {
        ...previous,
        accepted: snapshot({ digits: "", country }, previous.configuration),
        proposal: null,
      };
    });
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
    resetUncontrolled,
  };
}
