"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import type { ClipboardEvent } from "react";

import type { CountryCode, MetadataJson } from "libphonenumber-js/core";
import { getCountryCallingCode } from "libphonenumber-js/core";

import {
  buildFullNumber,
  cleanPhoneInput,
  defaultMetadata,
  detectCountryFromInput,
  formatOutputValue,
  getCountries,
  getDisplayValue,
  getInitialPhoneDigits,
  getPhoneNumberValidation,
  hasInternationalPrefix,
  isPhoneCountryCode,
  normalizeInternationalPrefix,
  parsePhoneNumber,
  requirePickerCountries,
  resolveSelectedCountry,
} from "../phone-engine";
import type {
  PhoneCountryCode,
  PhoneNumberCountry,
  PhoneNumberFormat,
  PhoneNumberValidation,
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
  isRequired?: boolean;
  onCountryChange?: (country: PhoneNumberCountry) => void;
  locale: string;
};

export type UsePhoneNumberFieldStateReturn = {
  displayValue: string;
  rawValue: string;
  outputValue: string;
  handleInputChange: (value: string) => void;
  handleCountrySelect: (code: CountryCode | undefined) => void;
  handlePaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  setCountry: (country: CountryCode | undefined) => void;
  country: PhoneCountryCode;
  selectedCountry: PhoneNumberCountry;
  callingCode: string | undefined;
  validation: PhoneNumberValidation;
  nationalNumber: string | undefined;
  countries: PhoneNumberCountry[];
  getCountryName: (countryCode: CountryCode) => string;
};

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
  isRequired = false,
  onCountryChange,
  locale,
}: UsePhoneNumberFieldStateOptions): UsePhoneNumberFieldStateReturn {
  const countries = useMemo(() => requirePickerCountries(getCountries(metadata)), [metadata]);
  const initialCountry = useMemo(
    () => resolveSelectedCountry(countries, defaultCountryCode),
    [countries, defaultCountryCode]
  );

  const [phoneDigits, setPhoneDigits] = useState("");
  const [country, setCountryState] = useState<PhoneCountryCode>(initialCountry.code);
  const [selectedCountry, setSelectedCountry] = useState<PhoneNumberCountry>(initialCountry);

  const updateCountry = useCallback(
    (newCountryCode: CountryCode | undefined) => {
      if (!newCountryCode || country === newCountryCode) {
        return false;
      }
      if (!isPhoneCountryCode(newCountryCode)) {
        return false;
      }
      const countryData = countries.find((entry) => entry.code === newCountryCode);
      if (!countryData) {
        return false;
      }
      setCountryState(countryData.code);
      setSelectedCountry(countryData);
      onCountryChange?.(countryData);
      return true;
    },
    [country, countries, onCountryChange]
  );

  const processInputWithDetection = useCallback(
    (input: string) => {
      if (!autoDetectCountry || !hasInternationalPrefix(input)) {
        return { digits: input, country };
      }

      const normalized = normalizeInternationalPrefix(input);
      const detectedCountry = detectCountryFromInput(normalized, metadata);

      if (detectedCountry && isPhoneCountryCode(detectedCountry) && updateCountry(detectedCountry)) {
        if (!international) {
          const phoneNumber = parsePhoneNumber(normalized, detectedCountry, metadata);
          return {
            digits: phoneNumber?.nationalNumber ?? normalized,
            country: detectedCountry,
          };
        }
        return { digits: normalized, country: detectedCountry };
      }

      return { digits: input, country };
    },
    [autoDetectCountry, country, international, metadata, updateCountry]
  );

  const setPhoneDigitsEvent = useEffectEvent(
    (nextValue: string, nextInternational: boolean, nextMetadata: MetadataJson) => {
      if (!nextValue) {
        setPhoneDigits("");
        return;
      }

      const decodedValue = decodeURIComponent(nextValue);
      const { digits, country: detectedCountry } = processInputWithDetection(decodedValue);

      if (detectedCountry === country) {
        const initialDigits = getInitialPhoneDigits(decodedValue, country, nextInternational, nextMetadata);
        setPhoneDigits(initialDigits);
      } else {
        setPhoneDigits(digits);
      }
    }
  );

  useEffect(() => {
    setPhoneDigitsEvent(value, international, metadata);
  }, [value, international, metadata]);

  const getOutputValue = useCallback(
    (digits: string, currentCountry: CountryCode | undefined) => {
      if (!digits) {
        return "";
      }
      const fullNumber = buildFullNumber(digits, currentCountry, metadata);
      const phoneNumber = parsePhoneNumber(fullNumber, currentCountry, metadata);
      return formatOutputValue(phoneNumber, digits, outputFormat);
    },
    [metadata, outputFormat]
  );

  const displayValue = useMemo(() => {
    if (!phoneDigits) {
      return "";
    }
    const fullNumber = buildFullNumber(phoneDigits, country, metadata);
    const phoneNumber = parsePhoneNumber(fullNumber, country, metadata);
    return getDisplayValue(phoneNumber, phoneDigits, international, formatOnType, country);
  }, [phoneDigits, country, international, formatOnType, metadata]);

  const handleInputChange = useCallback(
    (newValue: string) => {
      const cleaned = cleanPhoneInput(newValue);
      const { digits, country: detectedCountry } = processInputWithDetection(cleaned);
      setPhoneDigits(digits);
      onChange?.(getOutputValue(digits, detectedCountry));
    },
    [getOutputValue, processInputWithDetection, onChange]
  );

  const setCountry = useCallback(
    (newCountry: CountryCode | undefined) => {
      if (!updateCountry(newCountry)) {
        return;
      }
      if (!preserveOnCountryChange) {
        setPhoneDigits("");
        onChange?.("");
      } else {
        onChange?.(getOutputValue(phoneDigits, newCountry));
      }
    },
    [phoneDigits, preserveOnCountryChange, getOutputValue, updateCountry, onChange]
  );

  const handleCountrySelect = useCallback(
    (code: CountryCode | undefined) => {
      if (!code) {
        return;
      }
      const countryData = countries.find((entry) => entry.code === code);
      if (countryData) {
        setCountry(countryData.code);
      }
    },
    [countries, setCountry]
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

  const computedValues = useMemo(() => {
    let callingCode: string | undefined;
    try {
      callingCode = `+${getCountryCallingCode(country, metadata)}`;
    } catch {
      callingCode = undefined;
    }

    if (!phoneDigits) {
      return {
        callingCode,
        validation: getPhoneNumberValidation("", country, isRequired, metadata),
        outputValue: undefined,
        nationalNumber: undefined,
      };
    }

    const fullNumber = buildFullNumber(phoneDigits, country, metadata);
    const phoneNumber = parsePhoneNumber(fullNumber, country, metadata);
    const outputValue = formatOutputValue(phoneNumber, phoneDigits, outputFormat);
    const validation = getPhoneNumberValidation(outputValue, country, isRequired, metadata);

    return {
      callingCode,
      validation,
      outputValue,
      nationalNumber: phoneNumber?.nationalNumber,
    };
  }, [phoneDigits, country, isRequired, metadata, outputFormat]);

  return {
    displayValue,
    rawValue: phoneDigits,
    outputValue: computedValues.outputValue ?? "",
    handleInputChange,
    handleCountrySelect,
    handlePaste,
    setCountry,
    country,
    selectedCountry,
    callingCode: computedValues.callingCode,
    validation: computedValues.validation,
    nationalNumber: computedValues.nationalNumber,
    countries,
    getCountryName,
  };
}
