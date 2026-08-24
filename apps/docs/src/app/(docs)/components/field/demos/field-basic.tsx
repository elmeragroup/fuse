"use client";

import { Field } from "@elmeragroup/ui/field";

export function FieldBasic() {
  return (
    <Field.Root>
      <Field.Label>Email</Field.Label>
      <Field.Control render={<input type="email" />} />
      <Field.Description>Work address preferred.</Field.Description>
    </Field.Root>
  );
}
