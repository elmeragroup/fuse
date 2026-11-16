"use client";

import { Combobox } from "@elmeragroup/fuse/combobox";

const fruits = ["Apple", "Banana", "Orange", "Pear"];

export function ComboboxDisabledItem() {
  return (
    <Combobox.Root items={fruits}>
      <Combobox.Input aria-label="Fruit" placeholder="Search fruit…" />
      <Combobox.Content>
        <Combobox.Empty />
        <Combobox.List>
          <Combobox.Collection>
            {(item: string) => (
              <Combobox.Item key={item} value={item} disabled={item === "Banana"}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.Collection>
        </Combobox.List>
      </Combobox.Content>
    </Combobox.Root>
  );
}
