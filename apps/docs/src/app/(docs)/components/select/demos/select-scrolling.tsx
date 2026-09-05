"use client";

import { Select } from "@elmeragroup/ui/select";

const fruitNames = [
  "Apple",
  "Apricot",
  "Banana",
  "Blueberry",
  "Cherry",
  "Date",
  "Fig",
  "Grape",
  "Guava",
  "Kiwi",
  "Lemon",
  "Lime",
  "Mango",
  "Nectarine",
  "Orange",
  "Papaya",
  "Peach",
  "Pear",
  "Pineapple",
  "Plum",
  "Raspberry",
  "Strawberry",
  "Watermelon",
];

const fruits = Object.fromEntries(fruitNames.map((fruit) => [fruit.toLowerCase(), fruit]));

export function SelectScrolling() {
  return (
    <Select.Root items={fruits} defaultValue="mango">
      <Select.Trigger>
        <Select.Value placeholder="Pick a fruit" />
      </Select.Trigger>
      <Select.Content>
        {fruitNames.map((fruit) => (
          <Select.Item key={fruit} value={fruit.toLowerCase()}>
            {fruit}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
