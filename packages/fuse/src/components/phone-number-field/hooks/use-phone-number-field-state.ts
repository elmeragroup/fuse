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
import { receiveValue, reconcile, resetToDefault, snapshot, visibleSnapshot } from "../phone-field-state";
import type { PhoneState } from "../phone-field-state";

export type UsePhoneNumberFieldStateOptions = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  defaultCountryCode?: PhoneCountryCode;
  metadata?: MetadataJson;
  countries?: readonly PhoneCountryCode[];
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
  /**
   * Proposes an edit of the visible input. `onProposal` receives the display it proposes
   * before any state update or `onChange`, which a parent may commit synchronously.
   */
  handleInputChange: (value: string, onProposal?: (displayValue: string) => void) => void;
  selectCountry: (code: CountryCode | undefined) => void;
  handlePaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  selectedCountry: PhoneNumberCountry;
  countries: PhoneNumberCountry[];
  getCountryName: (countryCode: CountryCode) => string;
  /**
   * Native form-reset handler: restores `defaultValue`, or clears the digits in the visible
   * country without one; null when the parent owns `value`.
   */
  onReset: (() => void) | null;
};

export function usePhoneNumberFieldState({
  value,
  defaultValue,
  onChange,
  defaultCountryCode,
  metadata = defaultMetadata,
  countries: allowedCountries,
  autoDetectCountry = true,
  international = false,
  preserveOnCountryChange = false,
  outputFormat = "e164",
  formatOnType = false,
  onCountryChange,
  locale,
}: UsePhoneNumberFieldStateOptions): UsePhoneNumberFieldStateReturn {
  // Keyed on the codes, so a list written inline in the parent's render keeps its rows. An
  // empty list stays empty, and so throws, rather than reading as no list.
  const allowedKey = allowedCountries?.join(",");
  const countries = useMemo(() => {
    const allowed = allowedKey === undefined ? undefined : allowedKey === "" ? [] : allowedKey.split(",");
    return requirePickerCountries(getCountries(metadata, allowed));
  }, [metadata, allowedKey]);
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
    accepted: receiveValue(
      value ?? defaultValue ?? "",
      resolveSelectedCountry(countries, defaultCountryCode),
      configuration
    ),
    proposal: null,
  }));

  // Props are folded in during render so external replacement is visible in the same
  // pass, including server rendering. The store catches up on commit.
  const state = reconcile(stored, value, configuration);
  if (state !== stored) setState(state);
  const current = visibleSnapshot(state);
  const { digits, parsedNational, country: selectedCountry, values } = current;

  // Notify only committed country changes, including external value/catalog replacement and
  // a reset that restores a default in another country. A reset without a default keeps the
  // visible country, so it stays silent.
  const notifiedCountry = useRef(selectedCountry.code);
  useEffect(() => {
    if (notifiedCountry.current !== selectedCountry.code) {
      notifiedCountry.current = selectedCountry.code;
      onCountryChange?.(selectedCountry);
    }
  }, [selectedCountry, onCountryChange]);

  const propose = (next: ProcessedPhoneInput, onProposal?: (displayValue: string) => void) => {
    const proposal = snapshot(next, configuration);
    onProposal?.(proposal.values.displayValue);
    setState({ ...state, accepted: current, proposal });
    onChange?.(proposal.values.outputValue);
  };

  const handleInputChange = (input: string, onProposal?: (displayValue: string) => void) => {
    propose(
      processInputWithDetection({
        ...configuration,
        input: cleanPhoneInput(input),
        currentCountry: selectedCountry,
      }),
      onProposal
    );
  };

  const selectCountry = (code: CountryCode | undefined) => {
    if (!code || code === selectedCountry.code) return;
    const country = countries.find((row) => row.code === code);
    if (country) {
      propose(preserveOnCountryChange ? { digits, country, parsedNational } : { digits: "", country });
    }
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
    // Reset only when this hook owns the value. A parent-owned `value` is the parent's
    // to keep; a reset handler on this side would fight it.
    onReset:
      value === undefined
        ? () => {
            setState((stored) => resetToDefault(stored, defaultValue, defaultCountryCode));
          }
        : null,
  };
}
