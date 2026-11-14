"use client";

import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

export function ToggleGroupDisabledItem() {
  return (
    <ToggleGroup.Root defaultValue={["week"]} aria-label="Period">
      <ToggleGroup.Item value="day">Day</ToggleGroup.Item>
      <ToggleGroup.Item value="week">Week</ToggleGroup.Item>
      <ToggleGroup.Item value="month" disabled>
        Month
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
