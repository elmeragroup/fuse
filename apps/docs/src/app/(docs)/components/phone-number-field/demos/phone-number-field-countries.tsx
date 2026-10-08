"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldCountries() {
  return (
    <div className="flex flex-col gap-3">
      <PhoneNumberField
        label="Nordic mobile"
        description="The picker offers the four listed countries."
        countries={["NO", "SE", "DK", "FI"]}
      />
      <PhoneNumberField
        label="Swedish mobile"
        description="One country shows its dial code without a picker."
        countries={["SE"]}
      />
    </div>
  );
}
