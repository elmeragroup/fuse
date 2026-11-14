"use client";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxIndeterminate() {
  return (
    <Field.Root orientation="horizontal">
      <Checkbox indeterminate />
      <Field.Label>All notifications</Field.Label>
    </Field.Root>
  );
}
