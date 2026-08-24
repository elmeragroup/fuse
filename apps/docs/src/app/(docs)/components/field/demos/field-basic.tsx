"use client";

import { Field } from "@elmeragroup/ui/field";
import { Input } from "@elmeragroup/ui/input";

export function FieldBasic() {
  return (
    <Field.Root>
      <Field.Label>Email</Field.Label>
      <Input type="email" />
      <Field.Description>Work address preferred.</Field.Description>
    </Field.Root>
  );
}
