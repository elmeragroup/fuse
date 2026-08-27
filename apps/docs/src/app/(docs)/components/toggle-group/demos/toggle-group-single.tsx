"use client";

import { CaretLeft, CaretRight, Equals } from "@elmeragroup/ui/icons";
import { ToggleGroup } from "@elmeragroup/ui/toggle-group";

export function ToggleGroupSingle() {
  return (
    <ToggleGroup.Root defaultValue={["center"]} aria-label="Text alignment">
      <ToggleGroup.Item value="left" aria-label="Align left">
        <CaretLeft aria-hidden />
      </ToggleGroup.Item>
      <ToggleGroup.Item value="center" aria-label="Align center">
        <Equals aria-hidden />
      </ToggleGroup.Item>
      <ToggleGroup.Item value="right" aria-label="Align right">
        <CaretRight aria-hidden />
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
