"use client";

import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";

export function RadioGroupDisabledOption() {
  return (
    <RadioGroup label="Contract" defaultValue="fixed">
      <Radio value="fixed">Fixed price</Radio>
      <Radio value="spot" isDisabled>
        Spot price
      </Radio>
      <Radio value="hourly">Hourly price</Radio>
    </RadioGroup>
  );
}
