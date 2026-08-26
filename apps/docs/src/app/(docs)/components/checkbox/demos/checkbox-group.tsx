"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { CheckboxGroup, CheckboxItem } from "@elmeragroup/ui/checkbox";

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
        <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
        <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
        <CheckboxItem value="olive">Olive</CheckboxItem>
      </CheckboxGroup>
      <CheckboxGroup
        label="Sides"
        description="Wrapped horizontally."
        orientation="horizontal"
        value={horizontal}
        onChange={setHorizontal}>
        <CheckboxItem value="fries">Fries</CheckboxItem>
        <CheckboxItem value="salad">Salad</CheckboxItem>
      </CheckboxGroup>
      <Button type="button" onClick={() => setInvalid((current) => !current)}>
        {invalid ? "Clear error" : "Show error"}
      </Button>
    </div>
  );
}
