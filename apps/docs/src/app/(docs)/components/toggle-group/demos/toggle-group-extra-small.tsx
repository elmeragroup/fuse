"use client";

import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

export function ToggleGroupExtraSmall() {
  return (
    <ToggleGroup.Root defaultValue={["week"]} aria-label="Period" size="xs">
      <ToggleGroup.Item value="day">Day</ToggleGroup.Item>
      <ToggleGroup.Item value="week">Week</ToggleGroup.Item>
      <ToggleGroup.Item value="month">Month</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
