"use client";

import { Combobox } from "@elmeragroup/fuse/combobox";

const fruits = ["Apple", "Banana", "Orange", "Pear"];

export function ComboboxAlignEnd() {
  return (
    <div className="w-48">
      <Combobox.Root items={fruits}>
        <Combobox.Input aria-label="Fruit" placeholder="Search fruit…" />
        <Combobox.Content align="end" className="w-72">
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
