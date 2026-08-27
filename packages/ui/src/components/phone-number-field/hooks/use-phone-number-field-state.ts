"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import type { ClipboardEvent } from "react";

import type { CountryCode, MetadataJson } from "libphonenumber-js/core";

import {
  cleanPhoneInput,
  defaultMetadata,
  getCountries,
  processInputWithDetection,
  requirePickerCountries,
  resolvePhoneFieldValues,
  resolveSelectedCountry,
} from "../phone-engine";
import type { PhoneCountryCode, PhoneNumberCountry, PhoneNumberFormat } from "../phone-engine";

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

export function usePhoneNumberFieldState({
  value = "",
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
  const initialCountry = useMemo(
    () => resolveSelectedCountry(countries, defaultCountryCode),
    [countries, defaultCountryCode]
  );

  const [phoneState, setPhoneState] = useState<{ digits: string; country: PhoneNumberCountry }>({
    digits: "",
    country: initialCountry,
  });
  const { digits, country: selectedCountry } = phoneState;

  const outputFrom = useCallback(
    (nextDigits: string, countryCode: CountryCode) =>
      resolvePhoneFieldValues(nextDigits, countryCode, metadata, outputFormat, international, formatOnType)
        .outputValue,
    [metadata, outputFormat, international, formatOnType]
  );

  const commit = useCallback(
    (next: { digits: string; country: PhoneNumberCountry }) => {
      if (next.country.code !== selectedCountry.code) {
        onCountryChange?.(next.country);
      }
      setPhoneState(next);
      onChange?.(outputFrom(next.digits, next.country.code));
    },
    [selectedCountry.code, onCountryChange, onChange, outputFrom]
  );

  const syncValue = useEffectEvent(
    (nextValue: string, nextInternational: boolean, nextMetadata: MetadataJson) => {
      if (!nextValue) {
        setPhoneState((prev) => ({ ...prev, digits: "" }));
        return;
      }

      const decodedValue = decodeFieldValue(nextValue);
      const detected = processInputWithDetection(
        decodedValue,
        selectedCountry,
        countries,
        autoDetectCountry,
        nextInternational,
        nextMetadata
      );

      if (detected.country.code !== selectedCountry.code) {
        onCountryChange?.(detected.country);
      }
      setPhoneState(detected);
    }
  );

  useEffect(() => {
    syncValue(value, international, metadata);
  }, [value, international, metadata]);

  const handleInputChange = useCallback(
    (newValue: string) => {
      commit(
        processInputWithDetection(
          cleanPhoneInput(newValue),
          selectedCountry,
          countries,
          autoDetectCountry,
          international,
          metadata
        )
      );
    },
    [commit, selectedCountry, countries, autoDetectCountry, international, metadata]
  );

  const selectCountry = useCallback(
    (code: CountryCode | undefined) => {
      if (!code || code === selectedCountry.code) {
        return;
      }
      const nextCountry = countries.find((row) => row.code === code);
      if (!nextCountry) {
        return;
      }
      if (!preserveOnCountryChange) {
        commit({ digits: "", country: nextCountry });
        return;
      }
      commit({ digits, country: nextCountry });
    },
    [selectedCountry.code, countries, preserveOnCountryChange, commit, digits]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      handleInputChange(event.clipboardData.getData("text"));
    },
    [handleInputChange]
  );

  const formatterCountryName = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return new Intl.DisplayNames(["en-US"], { type: "region" });
    }
  }, [locale]);

  const getCountryName = useCallback(
    (countryCode: CountryCode) => formatterCountryName.of(countryCode) ?? countryCode,
    [formatterCountryName]
  );

  const { displayValue, outputValue } = useMemo(
    () =>
      resolvePhoneFieldValues(
        digits,
        selectedCountry.code,
        metadata,
        outputFormat,
        international,
        formatOnType
      ),
    [digits, selectedCountry.code, metadata, outputFormat, international, formatOnType]
  );

  return {
    displayValue,
    outputValue,
    handleInputChange,
    selectCountry,
    handlePaste,
    selectedCountry,
    countries,
    getCountryName,
  };
}
