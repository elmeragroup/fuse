"use client";

import { Checkbox, CheckboxDescription } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxDescriptionDemo() {
  return (
    <div className="flex flex-col gap-4">
      <CheckboxDescription describedBy="Optional extras billed monthly.">
        <Field.Root orientation="horizontal">
          <Checkbox />
          <Field.Label>Insurance</Field.Label>
        </Field.Root>
      </CheckboxDescription>
      <CheckboxDescription
        describedBy={
          <a href="#policy" className="text-sm text-primary underline underline-offset-4">
            Read the policy
          </a>
        }>
        <Field.Root orientation="horizontal">
          <Checkbox />
          <Field.Label>Paper invoices</Field.Label>
        </Field.Root>
      </CheckboxDescription>
    </div>
  );
}
