"use client";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxChecked() {
  return (
    <Field.Root orientation="horizontal">
      <Checkbox defaultChecked />
      <Field.Label>Email me receipts</Field.Label>
    </Field.Root>
  );
}
