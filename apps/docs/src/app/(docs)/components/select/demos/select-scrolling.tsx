"use client";

import { Select } from "@elmeragroup/fuse/select";

const fruits = {
  apple: "Apple",
  apricot: "Apricot",
  banana: "Banana",
  blueberry: "Blueberry",
  cherry: "Cherry",
  date: "Date",
  fig: "Fig",
  grape: "Grape",
  guava: "Guava",
  kiwi: "Kiwi",
  lemon: "Lemon",
  lime: "Lime",
  mango: "Mango",
  nectarine: "Nectarine",
  orange: "Orange",
  papaya: "Papaya",
  peach: "Peach",
  pear: "Pear",
  pineapple: "Pineapple",
  plum: "Plum",
  raspberry: "Raspberry",
  strawberry: "Strawberry",
  watermelon: "Watermelon",
} as const;

export function SelectScrolling() {
  return (
    <Select.Root items={fruits} defaultValue="mango">
      <Select.Trigger aria-label="Fruit">
        <Select.Value placeholder="Pick a fruit" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Item value="apricot">Apricot</Select.Item>
        <Select.Item value="banana">Banana</Select.Item>
        <Select.Item value="blueberry">Blueberry</Select.Item>
        <Select.Item value="cherry">Cherry</Select.Item>
        <Select.Item value="date">Date</Select.Item>
        <Select.Item value="fig">Fig</Select.Item>
        <Select.Item value="grape">Grape</Select.Item>
        <Select.Item value="guava">Guava</Select.Item>
        <Select.Item value="kiwi">Kiwi</Select.Item>
        <Select.Item value="lemon">Lemon</Select.Item>
        <Select.Item value="lime">Lime</Select.Item>
        <Select.Item value="mango">Mango</Select.Item>
        <Select.Item value="nectarine">Nectarine</Select.Item>
        <Select.Item value="orange">Orange</Select.Item>
        <Select.Item value="papaya">Papaya</Select.Item>
        <Select.Item value="peach">Peach</Select.Item>
        <Select.Item value="pear">Pear</Select.Item>
        <Select.Item value="pineapple">Pineapple</Select.Item>
        <Select.Item value="plum">Plum</Select.Item>
        <Select.Item value="raspberry">Raspberry</Select.Item>
        <Select.Item value="strawberry">Strawberry</Select.Item>
        <Select.Item value="watermelon">Watermelon</Select.Item>
      </Select.Content>
    </Select.Root>
  );
}
