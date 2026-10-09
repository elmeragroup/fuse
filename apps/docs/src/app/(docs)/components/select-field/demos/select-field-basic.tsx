"use client";

import { Select } from "@elmeragroup/fuse/select";
import { SelectField } from "@elmeragroup/fuse/select-field";

const plans = { basic: "Basic", plus: "Plus", pro: "Pro" } as const;

export function SelectFieldBasic() {
  return (
    <SelectField
      label="Plan"
      description="You can change plan later."
      name="plan"
      items={plans}
      placeholder="Choose a plan">
      <Select.Item value="basic">Basic</Select.Item>
      <Select.Item value="plus">Plus</Select.Item>
      <Select.Item value="pro">Pro</Select.Item>
    </SelectField>
  );
}
