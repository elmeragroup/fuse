"use client";

import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";

export function RadioGroupHorizontal() {
  return (
    <RadioGroup label="Contract" defaultValue="fixed" orientation="horizontal">
      <Radio value="fixed">Fixed price</Radio>
      <Radio value="spot">Spot price</Radio>
      <Radio value="hourly">Hourly price</Radio>
    </RadioGroup>
  );
}
