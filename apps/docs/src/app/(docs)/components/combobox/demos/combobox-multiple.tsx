"use client";

import { Combobox, useComboboxAnchor } from "@elmeragroup/fuse/combobox";

const fruits = ["Apple", "Banana", "Cherry", "Date"];

export function ComboboxMultiple() {
  const anchor = useComboboxAnchor();
  return (
    <Combobox.Root items={fruits} multiple defaultValue={["Apple", "Cherry"]}>
      <Combobox.Chips ref={anchor} aria-label="Selected fruit" className="w-72">
        <Combobox.Value>
          {(value: string[]) => value.map((item) => <Combobox.Chip key={item}>{item}</Combobox.Chip>)}
        </Combobox.Value>
        <Combobox.ChipsInput aria-label="Fruit" placeholder="Add fruit…" />
      </Combobox.Chips>
      <Combobox.Content anchor={anchor}>
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
