"use client";

import { Field } from "@elmeragroup/ui/field";
import { Input } from "@elmeragroup/ui/input";

export function FieldOrientations() {
  return (
    <Field.Group>
      <Field.Root orientation="vertical">
        <Field.Label>Vertical</Field.Label>
        <Input />
      </Field.Root>
      <Field.Root orientation="horizontal">
        <Field.Label>Horizontal</Field.Label>
        <Input />
      </Field.Root>
      <Field.Root orientation="responsive">
        <Field.Label>Responsive</Field.Label>
        <Input />
      </Field.Root>
    </Field.Group>
  );
}
