"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldCountries() {
  return <PhoneNumberField label="Nordic mobile" countries={["NO", "SE", "DK", "FI"]} />;
}
