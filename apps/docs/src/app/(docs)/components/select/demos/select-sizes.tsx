"use client";

import { Select } from "@elmeragroup/ui/select";

const fruits = {
  apple: "Apple",
  banana: "Banana",
  orange: "Orange",
} as const;

function FruitSelect({ size }: { size?: "sm" | "default" }) {
  return (
    <Select.Root items={fruits}>
      <Select.Trigger size={size}>
        <Select.Value placeholder={size === "sm" ? "Small" : "Default"} />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Item value="banana">Banana</Select.Item>
        <Select.Item value="orange">Orange</Select.Item>
      </Select.Content>
    </Select.Root>
  );
}

export function SelectSizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FruitSelect size="sm" />
      <FruitSelect />
    </div>
  );
}
