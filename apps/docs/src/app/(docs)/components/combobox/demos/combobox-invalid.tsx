"use client";

import { Combobox } from "@elmeragroup/fuse/combobox";
import { Field } from "@elmeragroup/fuse/field";

const fruits = ["Apple", "Banana", "Orange", "Pear"];

export function ComboboxInvalid() {
  return (
    <Field.Root invalid>
      <Field.Label>Fruit</Field.Label>
      <Combobox.Root items={fruits}>
        <Combobox.Input placeholder="Search fruit…" />
        <Combobox.Content>
          <Combobox.Empty />
          <Combobox.List>
            <Combobox.Collection>
              {(item: string) => (
                <Combobox.Item key={item} value={item}>
                  {item}
                </Combobox.Item>
              )}
            </Combobox.Collection>
          </Combobox.List>
        </Combobox.Content>
      </Combobox.Root>
      <Field.Error>Choose a fruit to continue.</Field.Error>
    </Field.Root>
  );
}
