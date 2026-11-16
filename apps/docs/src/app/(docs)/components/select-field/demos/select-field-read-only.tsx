"use client";

import { Select } from "@elmeragroup/fuse/select";
import { SelectField } from "@elmeragroup/fuse/select-field";

const plans = { basic: "Basic", plus: "Plus", pro: "Pro" } as const;

export function SelectFieldReadOnly() {
  return (
    <SelectField
      label="Plan"
      description="You can change plan later."
      items={plans}
      defaultValue="plus"
      isReadOnly>
      <Select.Item value="basic">Basic</Select.Item>
      <Select.Item value="plus">Plus</Select.Item>
      <Select.Item value="pro">Pro</Select.Item>
    </SelectField>
  );
}
