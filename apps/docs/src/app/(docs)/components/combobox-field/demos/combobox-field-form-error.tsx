"use client";

import { Combobox } from "@elmeragroup/fuse/combobox";
import { ComboboxField } from "@elmeragroup/fuse/combobox-field";
import { Form } from "@elmeragroup/fuse/form";

const operators = ["Arva", "BKK Nett", "Elvia", "Glitre Nett", "Lede", "Tensio"];

export function ComboboxFieldFormError() {
  return (
    <Form errors={{ gridOperator: "That grid operator does not serve this address." }}>
      <ComboboxField
        label="Grid operator"
        description="Printed on your grid bill."
        name="gridOperator"
        items={operators}
        defaultValue="Lede">
        <Combobox.Empty />
        <Combobox.List>
          {(operator: string) => (
            <Combobox.Item key={operator} value={operator}>
              {operator}
            </Combobox.Item>
          )}
        </Combobox.List>
      </ComboboxField>
    </Form>
  );
}
