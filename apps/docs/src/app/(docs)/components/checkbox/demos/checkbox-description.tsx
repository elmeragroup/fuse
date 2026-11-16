"use client";

import { Checkbox, CheckboxDescription } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxDescriptionDemo() {
  return (
    <CheckboxDescription describedBy="Billed monthly.">
      <Field.Root orientation="horizontal">
        <Checkbox />
        <Field.Label>Insurance</Field.Label>
      </Field.Root>
    </CheckboxDescription>
  );
}
