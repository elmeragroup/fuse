"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
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

function resolveDisplayNames(locale: string): Intl.DisplayNames {
  try {
    return new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    return new Intl.DisplayNames(["en-US"], { type: "region" });
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

  const cachedMetadataRef = useRef<MetadataJson | null>(null);

  const [phoneState, setPhoneState] = useState<ProcessedPhoneInput>({
    digits: "",
    country: initialCountry,
  });
  const { digits, country: selectedCountry } = phoneState;

  /**
   * `applyState` needs the output value to emit and the render below needs the same pair,
   * so one parse serves both (phone-number-field.md §8.16). The memo lives in a ref rather
   * than a `useMemo`: React may drop a `useMemo` at any time, and here that would silently
   * double the parse count instead of failing, so the cache is held where nothing evicts it
   * and every input it depends on is part of the key.
   */
  const valuesCacheRef = useRef<{ key: string; values: PhoneFieldValues } | null>(null);
  const resolveValues = useCallback(
    (input: ProcessedPhoneInput): PhoneFieldValues => {
      const key = JSON.stringify([
        input.country.code,
        input.digits,
        outputFormat,
        international,
        formatOnType,
      ]);
      const cached = valuesCacheRef.current;
      // The metadata document is compared by identity; it is a prop, not a value to hash.
      if (cached?.key === key && cachedMetadataRef.current === metadata) {
        return cached.values;
      }
      const values = resolvePhoneFieldValues({
        digits: input.digits,
        country: input.country.code,
        metadata,
        outputFormat,
        international,
        formatOnType,
      });
      valuesCacheRef.current = { key, values };
      cachedMetadataRef.current = metadata;
      return values;
    },
    [metadata, outputFormat, international, formatOnType]
  );

  // The value this hook last handed to `onChange`. A controlled parent echoing it straight
  // back is the common case, and re-processing it parses the same string a second time.
  const lastEmittedRef = useRef<string | null>(null);
  // The `international`/`metadata` pair the sync effect last ran on, so a change to either
  // still re-syncs even when `value` is the string the hook itself last emitted.
  const lastSyncRef = useRef<{ international: boolean; metadata: MetadataJson } | null>(null);

  /**
   * The single state application: country-change notification, the state write, and the
   * optional `onChange` emit. `commit` (emitting) and `syncValue` (not emitting) were the
   * same three steps written twice.
   */
  const applyState = useCallback(
    (next: ProcessedPhoneInput, { emitChange }: { emitChange: boolean }) => {
      if (next.country.code !== selectedCountry.code) {
        onCountryChange?.(next.country);
      }
      setPhoneState(next);
      if (emitChange) {
        const output = resolveValues(next).outputValue;
        lastEmittedRef.current = output;
        onChange?.(output);
      }
    },
    [selectedCountry.code, onCountryChange, onChange, resolveValues]
  );

  const syncValue = useEffectEvent(
    (nextValue: string, nextInternational: boolean, nextMetadata: MetadataJson) => {
      const lastSync = lastSyncRef.current;
      if (
        nextValue === lastEmittedRef.current &&
        lastSync?.international === nextInternational &&
        lastSync.metadata === nextMetadata
      ) {
        return;
      }
      lastSyncRef.current = { international: nextInternational, metadata: nextMetadata };

      if (!nextValue) {
        applyState({ digits: "", country: selectedCountry }, { emitChange: false });
        return;
      }

      applyState(
        processInputWithDetection({
          input: decodeFieldValue(nextValue),
          currentCountry: selectedCountry,
          countries,
          autoDetectCountry,
          international: nextInternational,
          metadata: nextMetadata,
        }),
        { emitChange: false }
      );
    }
  );

  useEffect(() => {
    syncValue(value, international, metadata);
  }, [value, international, metadata]);

  const handleInputChange = useCallback(
    (newValue: string) => {
      applyState(
        processInputWithDetection({
          input: cleanPhoneInput(newValue),
          currentCountry: selectedCountry,
          countries,
          autoDetectCountry,
          international,
          metadata,
        }),
        { emitChange: true }
      );
    },
    [applyState, selectedCountry, countries, autoDetectCountry, international, metadata]
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
      applyState(
        { digits: preserveOnCountryChange ? digits : "", country: nextCountry },
        { emitChange: true }
      );
    },
    [selectedCountry.code, countries, preserveOnCountryChange, applyState, digits]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      handleInputChange(event.clipboardData.getData("text"));
    },
    [handleInputChange]
  );

  /**
   * `Intl.DisplayNames.of` ran once per picker row per render, and the picker is ~230 rows.
   * The names for the whole picker set are resolved once per (locale, country set) instead;
   * a code outside that set still falls through to the formatter.
   */
  const getCountryName = useMemo(() => {
    const displayNames = resolveDisplayNames(locale);
    const names = new Map<CountryCode, string>();
    for (const country of countries) {
      names.set(country.code, displayNames.of(country.code) ?? country.code);
    }
    return (countryCode: CountryCode): string =>
      names.get(countryCode) ?? displayNames.of(countryCode) ?? countryCode;
  }, [countries, locale]);

  const { displayValue, outputValue } = resolveValues(phoneState);

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
