"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Form } from "@elmeragroup/fuse/form";
import type { FormProps } from "@elmeragroup/fuse/form";
import { Select } from "@elmeragroup/fuse/select";
import { SelectField } from "@elmeragroup/fuse/select-field";
import { TextField } from "@elmeragroup/fuse/text-field";

const plans = { basic: "Basic", plus: "Plus", pro: "Pro" } as const;

export function SelectFieldForm() {
  const [errors, setErrors] = useState<FormProps["errors"]>({});
  return (
    <Form
      errors={errors}
      onFormSubmit={() => {
        // A server action would answer here. This one rejects every submit.
        setErrors({ plan: "Pro is sold out in your area." });
      }}>
      <div className="flex flex-col gap-4">
        <TextField label="Company" name="company" defaultValue="Elmera" />
        <SelectField
          label="Plan"
          description="You can change plan later."
          name="plan"
          items={plans}
          defaultValue="pro"
          isRequired>
          <Select.Item value="basic">Basic</Select.Item>
          <Select.Item value="plus">Plus</Select.Item>
          <Select.Item value="pro">Pro</Select.Item>
        </SelectField>
        <Button type="submit">Order</Button>
      </div>
    </Form>
  );
}
