"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function InputInField() {
  return (
    <Field.Root invalid>
      <Field.Label>Email</Field.Label>
      <Input type="email" />
      <Field.Description>Work address preferred.</Field.Description>
      <Field.Error>Enter a valid email.</Field.Error>
    </Field.Root>
  );
}
