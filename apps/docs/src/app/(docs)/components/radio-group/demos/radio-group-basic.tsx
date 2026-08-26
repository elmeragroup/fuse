"use client";

import { useState } from "react";

import { Radio, RadioGroup } from "@elmeragroup/ui/radio-group";

export function RadioGroupBasic() {
  const [vertical, setVertical] = useState("fixed");
  const [horizontal, setHorizontal] = useState("monthly");

  return (
    <div className="flex flex-col gap-6">
      <RadioGroup
        label="Contract"
        description="Stacked vertically."
        orientation="vertical"
        value={vertical}
        onChange={setVertical}>
        <Radio value="fixed">Fixed</Radio>
        <Radio value="spot">Spot</Radio>
        <Radio value="hourly">Hourly</Radio>
      </RadioGroup>
      <RadioGroup
        label="Billing"
        description="Wrapped horizontally."
        orientation="horizontal"
        value={horizontal}
        onChange={setHorizontal}>
        <Radio value="monthly">Monthly</Radio>
        <Radio value="quarterly">Quarterly</Radio>
      </RadioGroup>
    </div>
  );
}
