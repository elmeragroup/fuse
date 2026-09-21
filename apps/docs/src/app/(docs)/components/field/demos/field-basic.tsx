"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function FieldBasic() {
  return (
    <Field.Root>
      <Field.Label>Email</Field.Label>
      <Input type="email" />
      <Field.Description>Work address preferred.</Field.Description>
    </Field.Root>
  );
}
