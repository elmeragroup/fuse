"use client";

import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

export function ToggleGroupMultiple() {
  return (
    <ToggleGroup.Root multiple defaultValue={["bold"]} aria-label="Text style">
      <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
      <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      <ToggleGroup.Item value="underline">Underline</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
