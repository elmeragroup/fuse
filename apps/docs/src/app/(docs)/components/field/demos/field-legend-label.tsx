"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function FieldLegendLabel() {
  return (
    <Field.Set>
      <Field.Legend variant="label">Billing contact</Field.Legend>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <Input type="email" />
      </Field.Root>
    </Field.Set>
  );
}
