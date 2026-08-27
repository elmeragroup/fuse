"use client";

import { PhoneNumberField } from "@elmeragroup/ui/phone-number-field";

export function PhoneNumberFieldStates() {
  return (
    <div className="flex flex-col gap-3">
      <PhoneNumberField
        label="Invalid"
        isInvalid
        errorMessage="Enter a mobile number."
        defaultCountryCode="NO"
      />
      <PhoneNumberField label="Disabled" isDisabled value="41234567" />
      <PhoneNumberField label="Read only" isReadOnly value="41234567" />
      <PhoneNumberField label="With action" endContent={<span className="text-sm pr-2">Work</span>} />
    </div>
  );
}
