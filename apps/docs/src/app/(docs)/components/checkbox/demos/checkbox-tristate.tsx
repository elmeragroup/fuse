"use client";

import { useState } from "react";

import { CheckboxGroup, CheckboxItem } from "@elmeragroup/ui/checkbox";

const ALL_VALUES = ["pepperoni", "mushroom", "olive"];

export function CheckboxTristate() {
  const [value, setValue] = useState<string[]>(["pepperoni", "mushroom"]);

  return (
    <CheckboxGroup
      label="Toppings"
      description="The parent is mixed when some, but not all, members are selected."
      allValues={ALL_VALUES}
      value={value}
      onChange={setValue}>
      <CheckboxItem parent>All toppings</CheckboxItem>
      <CheckboxItem value="pepperoni">Pepperoni</CheckboxItem>
      <CheckboxItem value="mushroom">Mushroom</CheckboxItem>
      <CheckboxItem value="olive">Olive</CheckboxItem>
    </CheckboxGroup>
  );
}
