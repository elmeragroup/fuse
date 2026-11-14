"use client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldEndContent() {
  return (
    <PhoneNumberField
      label="Mobile"
      endContent={<span className="text-sm pr-2 text-muted-foreground">Work</span>}
    />
  );
}
