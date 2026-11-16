"use client";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxInvalid() {
  return (
    <Field.Root invalid orientation="horizontal">
      <Checkbox />
      <Field.Label>Accept terms</Field.Label>
      <Field.Error>Accept the terms to continue.</Field.Error>
    </Field.Root>
  );
}
