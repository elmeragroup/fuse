"use client";

import { Combobox, useComboboxAnchor } from "@elmeragroup/fuse/combobox";

const fruits = ["Apple", "Banana", "Orange", "Pear"] as const;

function FruitList() {
  return (
    <>
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
    </>
  );
}

function FruitChips({ label, size }: { label: string; size?: "sm" | "default" }) {
  const anchor = useComboboxAnchor();
  return (
    <Combobox.Root items={[...fruits]} multiple defaultValue={["Apple"]}>
      <Combobox.Chips ref={anchor} size={size} aria-label={`${label} selected fruit`} className="w-64">
        <Combobox.Value>
          {(value: string[]) => value.map((item) => <Combobox.Chip key={item}>{item}</Combobox.Chip>)}
        </Combobox.Value>
        <Combobox.ChipsInput aria-label={`${label} fruits`} placeholder="Add fruit…" />
      </Combobox.Chips>
      <Combobox.Content anchor={anchor}>
        <FruitList />
      </Combobox.Content>
    </Combobox.Root>
  );
}

export function ComboboxSizes() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Combobox.Root items={[...fruits]}>
          <Combobox.Input size="sm" aria-label="Small fruit" placeholder="Small" />
          <Combobox.Content>
            <FruitList />
          </Combobox.Content>
        </Combobox.Root>
        <Combobox.Root items={[...fruits]}>
          <Combobox.Input aria-label="Default fruit" placeholder="Default" />
          <Combobox.Content>
            <FruitList />
          </Combobox.Content>
        </Combobox.Root>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FruitChips label="Small" size="sm" />
        <FruitChips label="Default" />
      </div>
    </div>
  );
}
