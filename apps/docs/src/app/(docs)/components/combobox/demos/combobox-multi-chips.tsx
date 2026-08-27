"use client";

import { Combobox, useComboboxAnchor } from "@elmeragroup/ui/combobox";

const fruits = ["Apple", "Banana", "Cherry", "Date"] as const;

export function ComboboxMultiChips() {
  const anchor = useComboboxAnchor();
  return (
    <Combobox.Root items={[...fruits]} multiple>
      <Combobox.Chips ref={anchor} aria-invalid aria-label="Selected fruit">
        <Combobox.Value>
          {(value: string[]) => value.map((item) => <Combobox.Chip key={item}>{item}</Combobox.Chip>)}
        </Combobox.Value>
        <Combobox.ChipsInput aria-label="Fruit" placeholder="Add fruit…" />
      </Combobox.Chips>
      <Combobox.Content anchor={anchor}>
        <Combobox.Input showClear showTrigger={false} aria-label="Filter fruit" placeholder="Filter…" />
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
