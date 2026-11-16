"use client";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxDemo() {
  return (
    <Field.Root orientation="horizontal">
      <Checkbox />
      <Field.Label>Accept terms</Field.Label>
    </Field.Root>
  );
}
