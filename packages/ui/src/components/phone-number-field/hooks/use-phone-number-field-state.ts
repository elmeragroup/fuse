"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
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
  ResolvePhoneFieldValuesOptions,
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

type CachedPhoneValues = ResolvePhoneFieldValuesOptions & { values: PhoneFieldValues };

function phoneFieldValuesFrom(
  input: ResolvePhoneFieldValuesOptions,
  cacheRef: { current: CachedPhoneValues | null }
): PhoneFieldValues {
  const cache = cacheRef.current;
  if (
    cache !== null &&
    cache.digits === input.digits &&
    cache.country === input.country &&
    cache.metadata === input.metadata &&
    cache.outputFormat === input.outputFormat &&
    cache.international === input.international &&
    cache.formatOnType === input.formatOnType
  ) {
    return cache.values;
  }
  const values = resolvePhoneFieldValues(input);
  cacheRef.current = { ...input, values };
  return values;
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

  const [phoneState, setPhoneState] = useState<ProcessedPhoneInput>({
    digits: "",
    country: initialCountry,
  });
  const { digits, country: selectedCountry } = phoneState;

  /**
   * applyState computes the next display/output pair at the emit call site and
   * records it here so the `useMemo` below reuses that parse. Written from
   * event/effect handlers, never from render (phone-number-field.md §8.16).
   */
  const valuesCacheRef = useRef<CachedPhoneValues | null>(null);

  // The value this hook last reconciled — emitted to `onChange` or synced from the parent.
  // A controlled parent echoing it straight back is the common case, and re-processing it
  // parses the same string a second time.
  const lastReconciledRef = useRef<string | null>(null);
  // The `international`/`metadata` pair the sync effect last ran on, so a change to either
  // still re-syncs even when `value` is the string the hook itself last reconciled.
  const lastSyncRef = useRef<{ international: boolean; metadata: MetadataJson } | null>(null);

  /**
   * The single state application: country-change notification, the state write, and the
   * optional `onChange` emit. `commit` (emitting) and `syncValue` (not emitting) were the
   * same three steps written twice.
   *
   * `onChange` / `onCountryChange` arrive as parent inline arrows, so wrapping this
   * chain in `useCallback` cannot keep `handleInputChange` / `selectCountry` /
   * `handlePaste` stable. They are recreated each render on purpose.
   */
  const applyState = (next: ProcessedPhoneInput, { emitChange }: { emitChange: boolean }) => {
    if (next.country.code !== selectedCountry.code) {
      onCountryChange?.(next.country);
    }
    setPhoneState(next);
    if (emitChange) {
      const values = phoneFieldValuesFrom(
        {
          digits: next.digits,
          country: next.country.code,
          metadata,
          outputFormat,
          international,
          formatOnType,
        },
        valuesCacheRef
      );
      lastReconciledRef.current = values.outputValue;
      onChange?.(values.outputValue);
    }
  };

  const syncValue = useEffectEvent(
    (nextValue: string, nextInternational: boolean, nextMetadata: MetadataJson) => {
      const lastSync = lastSyncRef.current;
      if (
        nextValue === lastReconciledRef.current &&
        lastSync?.international === nextInternational &&
        lastSync.metadata === nextMetadata
      ) {
        return;
      }
      lastSyncRef.current = { international: nextInternational, metadata: nextMetadata };
      lastReconciledRef.current = nextValue;

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

  const handleInputChange = (newValue: string) => {
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
  };

  const selectCountry = (code: CountryCode | undefined) => {
    if (!code || code === selectedCountry.code) {
      return;
    }
    const nextCountry = countries.find((row) => row.code === code);
    if (!nextCountry) {
      return;
    }
    applyState({ digits: preserveOnCountryChange ? digits : "", country: nextCountry }, { emitChange: true });
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    handleInputChange(event.clipboardData.getData("text"));
  };

  const getCountryName = useMemo(() => countryNameResolver(locale), [locale]);

  const { displayValue, outputValue } = useMemo(
    () =>
      phoneFieldValuesFrom(
        {
          digits,
          country: selectedCountry.code,
          metadata,
          outputFormat,
          international,
          formatOnType,
        },
        valuesCacheRef
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
