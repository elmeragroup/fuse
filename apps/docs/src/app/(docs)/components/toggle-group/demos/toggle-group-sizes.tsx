"use client";

import { ToggleGroup } from "@elmeragroup/ui/toggle-group";

export function ToggleGroupSizes() {
  return (
    <ToggleGroup.Root size="sm" defaultValue={["day"]} aria-label="Period">
      <ToggleGroup.Item value="day">Day</ToggleGroup.Item>
      <ToggleGroup.Item value="week" size="lg">
        Week
      </ToggleGroup.Item>
      <ToggleGroup.Item value="month">Month</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
