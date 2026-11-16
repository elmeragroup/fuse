"use client";

import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";

export function RadioGroupDescription() {
  return (
    <RadioGroup label="Contract" defaultValue="fixed" description="You can switch once a year.">
      <Radio value="fixed">Fixed price</Radio>
      <Radio value="spot">Spot price</Radio>
      <Radio value="hourly">Hourly price</Radio>
    </RadioGroup>
  );
}
