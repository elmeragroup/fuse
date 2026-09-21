"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

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
