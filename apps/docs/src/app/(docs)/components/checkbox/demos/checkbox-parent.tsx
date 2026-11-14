"use client";

import { Checkbox, CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxParent() {
  return (
    <CheckboxGroup
      label="Toppings"
      allValues={["pepperoni", "mushroom", "olive"]}
      defaultValue={["pepperoni", "mushroom"]}>
      <Field.Item className="flex">
        <Field.Label>
          <Checkbox parent />
          All toppings
        </Field.Label>
      </Field.Item>
      <Field.Item className="flex pl-6">
        <Field.Label>
          <Checkbox value="pepperoni" />
          Pepperoni
        </Field.Label>
      </Field.Item>
      <Field.Item className="flex pl-6">
        <Field.Label>
          <Checkbox value="mushroom" />
          Mushroom
        </Field.Label>
      </Field.Item>
      <Field.Item className="flex pl-6">
        <Field.Label>
          <Checkbox value="olive" />
          Olive
        </Field.Label>
      </Field.Item>
    </CheckboxGroup>
  );
}
