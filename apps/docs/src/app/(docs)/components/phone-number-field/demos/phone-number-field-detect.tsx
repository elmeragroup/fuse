"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldDetect() {
  return (
    <PhoneNumberField
      label="Paste a number"
      description="Paste a +prefixed number to switch country. Try +46 70 123 45 67."
      autoDetectCountry
    />
  );
}
