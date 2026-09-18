"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { Checkbox, CheckboxGroup } from "@elmeragroup/ui/checkbox";
import { Field } from "@elmeragroup/ui/field";

const toppings = [
  { value: "pepperoni", label: "Pepperoni" },
  { value: "mushroom", label: "Mushroom" },
  { value: "olive", label: "Olive" },
];

const sides = [
  { value: "fries", label: "Fries" },
  { value: "salad", label: "Salad" },
];

export function CheckboxGroupDemo() {
  const [vertical, setVertical] = useState<string[]>(["pepperoni"]);
  const [horizontal, setHorizontal] = useState<string[]>(["fries"]);
  const [invalid, setInvalid] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <CheckboxGroup
        label="Toppings"
        description="Stacked vertically."
        orientation="vertical"
        value={vertical}
        onChange={setVertical}
        isInvalid={invalid}
        errorMessage={invalid ? "Pick at least one topping." : undefined}>
        {toppings.map((topping) => (
          <Field.Item key={topping.value} className="flex">
            <Field.Label>
              <Checkbox value={topping.value} />
              {topping.label}
            </Field.Label>
          </Field.Item>
        ))}
      </CheckboxGroup>
      <CheckboxGroup
        label="Sides"
        description="Wrapped horizontally."
        orientation="horizontal"
        value={horizontal}
        onChange={setHorizontal}>
        {sides.map((side) => (
          <Field.Item key={side.value} className="flex">
            <Field.Label>
              <Checkbox value={side.value} />
              {side.label}
            </Field.Label>
          </Field.Item>
        ))}
      </CheckboxGroup>
      <Button type="button" onClick={() => setInvalid((current) => !current)}>
        {invalid ? "Clear error" : "Show error"}
      </Button>
    </div>
  );
}
