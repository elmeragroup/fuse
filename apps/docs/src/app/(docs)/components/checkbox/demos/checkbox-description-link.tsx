"use client";

import { Checkbox, CheckboxDescription } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxDescriptionLink() {
  return (
    <CheckboxDescription
      describedBy={
        <a href="#policy" className="text-sm text-primary underline underline-offset-4">
          Read the policy
        </a>
      }>
      <Field.Root orientation="horizontal">
        <Checkbox />
        <Field.Label>Insurance</Field.Label>
      </Field.Root>
    </CheckboxDescription>
  );
}
