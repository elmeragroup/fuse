"use client";

import { useState } from "react";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import { FuseProvider } from "@elmeragroup/fuse/theme";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";

const LOCALES = [
  { code: "nb-NO", label: "Norsk" },
  { code: "sv-SE", label: "Svenska" },
  { code: "en-US", label: "English" },
  { code: "fi-FI", label: "Suomi" },
] as const satisfies readonly { code: SupportedLocale; label: string }[];

export function PhoneNumberFieldI18n() {
  const [locale, setLocale] = useState<SupportedLocale>("nb-NO");

  return (
    <div className="flex flex-col gap-4">
      <label>
        Language
        <select
          value={locale}
          onChange={(event) => {
            const next = LOCALES.find((option) => option.code === event.target.value);
            if (next !== undefined) {
              setLocale(next.code);
            }
          }}>
          {LOCALES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <FuseProvider locale={locale}>
        <PhoneNumberField label="Mobile" />
      </FuseProvider>
      <PhoneNumberField
        label="Override"
        selectCountryLabel="Pick a country"
        searchCountriesLabel="Filter countries"
        noCountriesFoundText="Nothing here."
      />
    </div>
  );
}
