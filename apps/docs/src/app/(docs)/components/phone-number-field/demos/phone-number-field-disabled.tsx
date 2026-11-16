"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldDisabled() {
  return <PhoneNumberField label="Mobile" defaultValue="41234567" isDisabled />;
}
