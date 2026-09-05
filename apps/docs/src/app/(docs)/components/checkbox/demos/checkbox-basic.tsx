"use client";

import { Checkbox } from "@elmeragroup/ui/checkbox";
import { Field } from "@elmeragroup/ui/field";

export function CheckboxBasic() {
  return (
    <Field.Root orientation="horizontal">
      <Checkbox defaultChecked />
      <Field.Label>Accept terms</Field.Label>
    </Field.Root>
  );
}
