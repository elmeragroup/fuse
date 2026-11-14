"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function FieldDisabled() {
  return (
    <Field.Root disabled>
      <Field.Label>Customer number</Field.Label>
      <Input defaultValue="204 117" />
      <Field.Description>Set when the account opens.</Field.Description>
    </Field.Root>
  );
}
