"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function FieldHorizontal() {
  return (
    <Field.Root orientation="horizontal">
      <Field.Label>Meter number</Field.Label>
      <Input inputMode="numeric" />
    </Field.Root>
  );
}
