"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function FieldErrorDemo() {
  return (
    <Field.Root invalid>
      <Field.Label>Email</Field.Label>
      <Input type="email" defaultValue="ada" />
      <Field.Error>Enter a work email.</Field.Error>
      <Field.Description>Work address preferred.</Field.Description>
    </Field.Root>
  );
}
