"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldCustomLabels() {
  return (
    <PhoneNumberField
      label="Mobile"
      selectCountryLabel="Pick a country"
      searchCountriesLabel="Filter countries"
      noCountriesFoundText="No country by that name."
    />
  );
}
