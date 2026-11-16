"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldWithoutDetection() {
  return <PhoneNumberField label="Mobile" autoDetectCountry={false} defaultValue="+46701234567" />;
}
