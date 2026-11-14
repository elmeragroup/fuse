"use client";

import { Select } from "@elmeragroup/fuse/select";

const fruits = {
  apple: "Apple",
  banana: "Banana",
  orange: "Orange",
  pear: "Pear",
} as const;

export function SelectMultiple() {
  return (
    <Select.Root items={fruits} multiple defaultValue={["apple", "pear"]}>
      <Select.Trigger aria-label="Fruits">
        <Select.Value placeholder="Pick fruits" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Item value="banana">Banana</Select.Item>
        <Select.Item value="orange">Orange</Select.Item>
        <Select.Item value="pear">Pear</Select.Item>
      </Select.Content>
    </Select.Root>
  );
}
