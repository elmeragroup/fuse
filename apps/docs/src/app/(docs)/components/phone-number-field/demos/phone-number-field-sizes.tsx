"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldSizes() {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <PhoneNumberField size="sm" label="Small" className="w-64" />
      <PhoneNumberField label="Default" className="w-64" />
    </div>
  );
}
