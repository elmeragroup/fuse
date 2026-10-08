"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function FieldValidationDemo() {
  return (
    <Field.Root
      validationMode="onBlur"
      validate={(value) => (String(value).endsWith("@example.com") ? null : "Use your example.com address.")}>
      <Field.Label>Work email</Field.Label>
      <Input type="email" required />
      <Field.Error />
      <Field.Description>Checked when you leave the field.</Field.Description>
    </Field.Root>
  );
}
