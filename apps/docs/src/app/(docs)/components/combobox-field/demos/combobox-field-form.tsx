"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Combobox } from "@elmeragroup/fuse/combobox";
import { ComboboxField } from "@elmeragroup/fuse/combobox-field";
import { Form } from "@elmeragroup/fuse/form";
import type { FormProps } from "@elmeragroup/fuse/form";
import { TextField } from "@elmeragroup/fuse/text-field";

const operators = ["Arva", "BKK Nett", "Elvia", "Glitre Nett", "Lede", "Tensio"];

export function ComboboxFieldForm() {
  const [errors, setErrors] = useState<FormProps["errors"]>({});
  return (
    <Form
      errors={errors}
      onFormSubmit={() => {
        // A server action would answer here. This one rejects every submit.
        setErrors({ gridOperator: "That grid operator does not serve this address." });
      }}>
      <div className="flex flex-col gap-4">
        <TextField label="Address" name="address" defaultValue="Storgata 1, Oslo" />
        <ComboboxField
          label="Grid operator"
          description="Printed on your grid bill."
          name="gridOperator"
          items={operators}
          defaultValue="Lede"
          isRequired>
          <Combobox.Empty />
          <Combobox.List>
            {(operator: string) => (
              <Combobox.Item key={operator} value={operator}>
                {operator}
              </Combobox.Item>
            )}
          </Combobox.List>
        </ComboboxField>
        <Button type="submit">Continue</Button>
      </div>
    </Form>
  );
}
