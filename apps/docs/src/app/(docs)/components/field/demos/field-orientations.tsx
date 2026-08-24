"use client";

import { Field } from "@elmeragroup/ui/field";

export function FieldOrientations() {
  return (
    <Field.Group>
      <Field.Root orientation="vertical">
        <Field.Label>Vertical</Field.Label>
        <Field.Control render={<input />} />
      </Field.Root>
      <Field.Root orientation="horizontal">
        <Field.Label>Horizontal</Field.Label>
        <Field.Control render={<input />} />
      </Field.Root>
      <Field.Root orientation="responsive">
        <Field.Label>Responsive</Field.Label>
        <Field.Control render={<input />} />
      </Field.Root>
    </Field.Group>
  );
}
