"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function InputNumeric() {
  return (
    <Field.Root>
      <Field.Label>Mobile number</Field.Label>
      <Input type="tel" filter="numeric" maxLength={8} placeholder="912 34 567" />
      <Field.Description>Pasting 912 34 567 keeps all eight digits.</Field.Description>
    </Field.Root>
  );
}
