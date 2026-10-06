"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function FieldSetDescriptionDemo() {
  return (
    <Field.Set>
      <Field.Legend>Contact</Field.Legend>
      <Field.Description>Fill in at least one. We reply within one working day.</Field.Description>
      <Field.Group>
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <Input type="email" />
        </Field.Root>
        <Field.Root>
          <Field.Label>Phone</Field.Label>
          <Input type="tel" />
        </Field.Root>
      </Field.Group>
    </Field.Set>
  );
}
