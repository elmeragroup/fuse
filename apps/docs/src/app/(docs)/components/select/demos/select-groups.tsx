"use client";

import { Select } from "@elmeragroup/fuse/select";

const fruits = {
  lemon: "Lemon",
  lime: "Lime",
  orange: "Orange",
  blueberry: "Blueberry",
  strawberry: "Strawberry",
} as const;

export function SelectGroups() {
  return (
    <Select.Root items={fruits}>
      <Select.Trigger>
        <Select.Value placeholder="Pick a fruit" />
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          <Select.Label>Citrus</Select.Label>
          <Select.Item value="lemon">Lemon</Select.Item>
          <Select.Item value="lime">Lime</Select.Item>
          <Select.Item value="orange">Orange</Select.Item>
        </Select.Group>
        <Select.Separator />
        <Select.Group>
          <Select.Label>Berries</Select.Label>
          <Select.Item value="blueberry">Blueberry</Select.Item>
          <Select.Item value="strawberry">Strawberry</Select.Item>
        </Select.Group>
      </Select.Content>
    </Select.Root>
  );
}
