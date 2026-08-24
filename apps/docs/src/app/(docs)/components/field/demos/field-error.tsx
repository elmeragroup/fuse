"use client";

import { Field } from "@elmeragroup/ui/field";
import { Input } from "@elmeragroup/ui/input";

export function FieldErrorDemo() {
  return (
    <Field.Root invalid>
      <Field.Label>Email</Field.Label>
      <Input type="email" />
      <Field.Error>Enter a work email.</Field.Error>
    </Field.Root>
  );
}
