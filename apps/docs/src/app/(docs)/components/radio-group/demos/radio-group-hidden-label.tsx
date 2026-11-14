"use client";

import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";

export function RadioGroupHiddenLabel() {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-medium">Contract</h3>
      <RadioGroup label="Contract" isLabelHidden defaultValue="fixed">
        <Radio value="fixed">Fixed price</Radio>
        <Radio value="spot">Spot price</Radio>
      </RadioGroup>
    </section>
  );
}
