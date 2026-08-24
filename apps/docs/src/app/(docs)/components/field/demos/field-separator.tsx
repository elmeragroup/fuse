"use client";

import { Field } from "@elmeragroup/ui/field";
import { Input } from "@elmeragroup/ui/input";

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
