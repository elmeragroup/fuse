"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldFormatOnType() {
  return <PhoneNumberField label="Mobile" defaultCountryCode="SE" defaultValue="0701234567" formatOnType />;
}
