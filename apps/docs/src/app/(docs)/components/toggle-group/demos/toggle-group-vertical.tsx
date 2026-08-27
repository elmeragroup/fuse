"use client";

import { ToggleGroup } from "@elmeragroup/ui/toggle-group";

export function ToggleGroupVertical() {
  return (
    <ToggleGroup.Root orientation="vertical" defaultValue={["delivery"]} aria-label="Channel">
      <ToggleGroup.Item value="delivery">Delivery</ToggleGroup.Item>
      <ToggleGroup.Item value="meter">Meter point</ToggleGroup.Item>
      <ToggleGroup.Item value="billing">Billing</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
