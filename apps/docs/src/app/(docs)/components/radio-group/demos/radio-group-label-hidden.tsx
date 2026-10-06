"use client";

import { useState } from "react";

import { Heading } from "@elmeragroup/fuse/heading";
import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";

export function RadioGroupLabelHidden() {
  const [value, setValue] = useState("fixed");

  return (
    <div className="flex flex-col gap-3">
      <Heading level={3}>Contract</Heading>
      <RadioGroup label="Contract" isLabelHidden value={value} onChange={setValue}>
        <Radio value="fixed">Fixed</Radio>
        <Radio value="spot">Spot</Radio>
      </RadioGroup>
    </div>
  );
}
