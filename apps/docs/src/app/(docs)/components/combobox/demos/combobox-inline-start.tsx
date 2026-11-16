"use client";

import { Combobox } from "@elmeragroup/fuse/combobox";

const fruits = ["Apple", "Banana", "Orange", "Pear"];

export function ComboboxInlineStart() {
  return (
    <div className="me-0 w-56">
      <Combobox.Root items={fruits}>
        <Combobox.Input aria-label="Fruit" placeholder="Search fruit…" />
        <Combobox.Content side="inline-start">
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
    </div>
  );
}
