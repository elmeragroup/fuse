"use client";

import { Select } from "@elmeragroup/fuse/select";
import { SelectField } from "@elmeragroup/fuse/select-field";

const plans = { basic: "Basic", plus: "Plus", pro: "Pro" } as const;

function PlanField({ label, size }: { label: string; size?: "sm" | "default" }) {
  return (
    <SelectField label={label} size={size} items={plans} placeholder="Choose a plan" className="w-56">
      <Select.Item value="basic">Basic</Select.Item>
      <Select.Item value="plus">Plus</Select.Item>
      <Select.Item value="pro">Pro</Select.Item>
    </SelectField>
  );
}

export function SelectFieldSizes() {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <PlanField label="Small" size="sm" />
      <PlanField label="Default" />
    </div>
  );
}
