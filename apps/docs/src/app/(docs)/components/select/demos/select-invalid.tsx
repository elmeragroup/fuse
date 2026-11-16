"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Select } from "@elmeragroup/fuse/select";

const plans = { basic: "Basic", plus: "Plus", pro: "Pro" } as const;

export function SelectInvalid() {
  return (
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
  );
}
