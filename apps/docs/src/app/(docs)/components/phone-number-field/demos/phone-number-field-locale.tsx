"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import { LocaleProvider } from "@elmeragroup/fuse/theme";

export function PhoneNumberFieldLocale() {
  return (
    <LocaleProvider locale="sv-SE">
      <PhoneNumberField label="Mobilnummer" defaultCountryCode="SE" />
    </LocaleProvider>
  );
}
