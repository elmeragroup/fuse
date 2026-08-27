"use client";

import { Combobox } from "@elmeragroup/ui/combobox";

const fruits = ["Apple", "Banana", "Orange", "Pear"] as const;

export function ComboboxBasic() {
  return (
    <Combobox.Root items={[...fruits]}>
      <Combobox.Input aria-label="Fruit" placeholder="Search fruit…" />
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
  );
}
