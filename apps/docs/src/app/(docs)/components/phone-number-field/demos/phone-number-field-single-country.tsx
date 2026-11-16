"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldSingleCountry() {
  return <PhoneNumberField label="Swedish mobile" countries={["SE"]} />;
}
