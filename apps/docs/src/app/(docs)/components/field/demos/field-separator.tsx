"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function FieldSeparatorDemo() {
  return (
    <Field.Group>
      <Field.Root>
        <Field.Label>Given name</Field.Label>
        <Input />
      </Field.Root>
      <Field.Separator>Account</Field.Separator>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <Input type="email" />
      </Field.Root>
    </Field.Group>
  );
}
