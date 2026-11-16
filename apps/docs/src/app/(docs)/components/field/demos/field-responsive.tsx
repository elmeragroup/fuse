"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function FieldResponsive() {
  return (
    <Field.Group>
      <Field.Root orientation="responsive">
        <Field.Label>Meter number</Field.Label>
        <Input inputMode="numeric" />
      </Field.Root>
    </Field.Group>
  );
}
