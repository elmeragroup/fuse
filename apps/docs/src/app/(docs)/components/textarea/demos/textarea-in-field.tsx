"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Textarea } from "@elmeragroup/fuse/textarea";

export function TextareaInField() {
  return (
    <Field.Root invalid>
      <Field.Label>Notes</Field.Label>
      <Field.Control render={<Textarea />} />
      <Field.Description>Optional context for the order.</Field.Description>
      <Field.Error>Tell us a bit more.</Field.Error>
    </Field.Root>
  );
}
