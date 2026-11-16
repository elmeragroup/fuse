"use client";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxReadOnly() {
  return (
    <Field.Root orientation="horizontal">
      <Checkbox readOnly defaultChecked />
      <Field.Label>Electronic invoices</Field.Label>
    </Field.Root>
  );
}
