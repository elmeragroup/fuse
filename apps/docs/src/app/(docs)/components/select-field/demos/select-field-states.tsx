"use client";

import { Select } from "@elmeragroup/fuse/select";
import { SelectField } from "@elmeragroup/fuse/select-field";

const plans = { basic: "Basic", plus: "Plus", pro: "Pro" } as const;
const regions = { oslo: "Oslo", bergen: "Bergen" } as const;

export function SelectFieldStates() {
  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label="Plan"
        description="You can change plan later."
        items={plans}
        placeholder="Choose a plan"
        isInvalid
        errorMessage="Choose a plan to continue.">
        <Select.Item value="basic">Basic</Select.Item>
        <Select.Item value="plus">Plus</Select.Item>
        <Select.Item value="pro">Pro</Select.Item>
      </SelectField>
      <SelectField label="Region" items={regions} placeholder="Unavailable" isDisabled>
        <Select.Item value="oslo">Oslo</Select.Item>
        <Select.Item value="bergen">Bergen</Select.Item>
      </SelectField>
    </div>
  );
}
