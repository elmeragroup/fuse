"use client";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxBasic() {
  return (
    <Field.Root orientation="horizontal">
      <Checkbox defaultChecked />
      <Field.Label>Accept terms</Field.Label>
    </Field.Root>
  );
}
