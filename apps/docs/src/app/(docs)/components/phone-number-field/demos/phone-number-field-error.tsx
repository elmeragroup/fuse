"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldError() {
  return (
    <PhoneNumberField label="Mobile" defaultValue="4123" isInvalid errorMessage="Enter a mobile number." />
  );
}
