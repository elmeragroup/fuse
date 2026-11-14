"use client";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxDisabled() {
  return (
    <Field.Root orientation="horizontal">
      <Checkbox disabled />
      <Field.Label>Paper invoices</Field.Label>
    </Field.Root>
  );
}
