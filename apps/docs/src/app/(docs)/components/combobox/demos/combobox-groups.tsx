"use client";

import { Combobox } from "@elmeragroup/ui/combobox";

const groups = [
  { value: "Citrus", items: ["Lemon", "Lime", "Orange"] },
  { value: "Berries", items: ["Blueberry", "Strawberry"] },
] as const;

export function ComboboxGroups() {
  return (
    <Combobox.Root items={[...groups]}>
      <Combobox.Input aria-label="Fruit" placeholder="Search fruit…" />
      <Combobox.Content>
        <Combobox.Empty />
        <Combobox.List>
          <Combobox.Collection>
            {(group: (typeof groups)[number], index: number) => (
              <>
                {index > 0 ? <Combobox.Separator /> : null}
                <Combobox.Group key={group.value} items={[...group.items]}>
                  <Combobox.Label>{group.value}</Combobox.Label>
                  <Combobox.Collection>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              </>
            )}
          </Combobox.Collection>
        </Combobox.List>
      </Combobox.Content>
    </Combobox.Root>
  );
}
