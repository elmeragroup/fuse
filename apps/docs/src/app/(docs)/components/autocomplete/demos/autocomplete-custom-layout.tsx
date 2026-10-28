"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";
import { Field } from "@elmeragroup/fuse/field";
import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

const operators = ["Elvia", "BKK Nett", "Lede", "Tensio", "Glitre Nett", "Arva"];

export function AutocompleteCustomLayout() {
  return (
    <Field.Root name="gridOperator" className="max-w-xs">
      <Field.Label>
        Grid operator
        <PopoverInfoButton>
          The company that owns the power lines to your home. It is printed on your grid bill.
        </PopoverInfoButton>
      </Field.Label>
      <Autocomplete.Root id="grid-operator" items={operators}>
        <Autocomplete.Input placeholder="Type a grid operator…" />
        <Autocomplete.Content>
          <Autocomplete.Empty />
          <Autocomplete.List>
            {(operator: string) => (
              <Autocomplete.Item key={operator} value={operator}>
                {operator}
              </Autocomplete.Item>
            )}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete.Root>
    </Field.Root>
  );
}
