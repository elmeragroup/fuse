"use client";

import { Checkbox, CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";

export function CheckboxGroupHiddenLabel() {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-medium">Toppings</h3>
      <CheckboxGroup label="Toppings" isLabelHidden defaultValue={["mushroom"]}>
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
      </CheckboxGroup>
    </section>
  );
}
