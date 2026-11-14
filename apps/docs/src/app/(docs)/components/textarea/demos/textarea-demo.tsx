"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Textarea } from "@elmeragroup/fuse/textarea";

export function TextareaDemo() {
  return (
    <Field.Root>
      <Field.Label>Delivery notes</Field.Label>
      <Field.Control render={<Textarea placeholder="Tell us more" />} />
    </Field.Root>
  );
}
