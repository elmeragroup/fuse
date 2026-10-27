"use client";

import { Field } from "@elmeragroup/fuse/field";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { TextField } from "@elmeragroup/fuse/text-field";

export function FieldSpacing() {
  return (
    <div className="sm:grid-cols-2 grid w-full gap-4">
      <TextField label="Meter number" description="Printed on the meter." filter="numeric" />
      <Field.Root spacing="part">
        <Field.Label>Annual usage</Field.Label>
        <InputGroup.Root>
          <InputGroup.Input filter="numeric" />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Text>kWh</InputGroup.Text>
          </InputGroup.Addon>
        </InputGroup.Root>
        <Field.Description>Over the last 12 months.</Field.Description>
      </Field.Root>
    </div>
  );
}
