"use client";

import { Checkbox } from "@elmeragroup/ui/checkbox";
import { Field } from "@elmeragroup/ui/field";

export function FieldChoiceCard() {
  return (
    <Field.Root>
      <Field.Label htmlFor="field-choice-card-fixed">
        <Field.Root orientation="horizontal">
          <Checkbox id="field-choice-card-fixed" />
          <Field.Content>
            <Field.Title>Fixed price</Field.Title>
            <Field.Description>Lock the kilowatt-hour rate for twelve months.</Field.Description>
          </Field.Content>
        </Field.Root>
      </Field.Label>
    </Field.Root>
  );
}
