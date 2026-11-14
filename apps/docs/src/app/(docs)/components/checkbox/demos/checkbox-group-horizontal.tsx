"use client";

import { Checkbox, CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxGroupHorizontal() {
  return (
    <CheckboxGroup label="Toppings" defaultValue={["mushroom"]} orientation="horizontal">
      <Field.Item className="flex">
        <Field.Label>
          <Checkbox value="pepperoni" />
          Pepperoni
        </Field.Label>
      </Field.Item>
      <Field.Item className="flex">
        <Field.Label>
          <Checkbox value="mushroom" />
          Mushroom
        </Field.Label>
      </Field.Item>
      <Field.Item className="flex">
        <Field.Label>
          <Checkbox value="olive" />
          Olive
        </Field.Label>
      </Field.Item>
    </CheckboxGroup>
  );
}
