"use client";

import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";

export function RadioGroupError() {
  return (
    <RadioGroup
      label="Contract"
      defaultValue="fixed"
      isInvalid
      errorMessage="Fixed price is not offered at this address.">
      <Radio value="fixed">Fixed price</Radio>
      <Radio value="spot">Spot price</Radio>
      <Radio value="hourly">Hourly price</Radio>
    </RadioGroup>
  );
}
