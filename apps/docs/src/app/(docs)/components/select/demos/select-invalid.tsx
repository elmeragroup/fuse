"use client";

import { Field } from "@elmeragroup/ui/field";
import { Select } from "@elmeragroup/ui/select";

const plans = { basic: "Basic", plus: "Plus", pro: "Pro" } as const;
const regions = { oslo: "Oslo", bergen: "Bergen" } as const;

export function SelectInvalid() {
  return (
    <div className="flex flex-col gap-4">
      <Field.Root invalid>
        <Field.Label>Plan</Field.Label>
        <Select.Root items={plans}>
          <Select.Trigger>
            <Select.Value placeholder="Pick a plan" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="basic">Basic</Select.Item>
            <Select.Item value="plus">Plus</Select.Item>
            <Select.Item value="pro">Pro</Select.Item>
          </Select.Content>
        </Select.Root>
        <Field.Error>Choose a plan to continue.</Field.Error>
      </Field.Root>
      <Field.Root disabled>
        <Field.Label>Region</Field.Label>
        <Select.Root items={regions} disabled>
          <Select.Trigger>
            <Select.Value placeholder="Unavailable" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="oslo">Oslo</Select.Item>
            <Select.Item value="bergen">Bergen</Select.Item>
          </Select.Content>
        </Select.Root>
      </Field.Root>
    </div>
  );
}
