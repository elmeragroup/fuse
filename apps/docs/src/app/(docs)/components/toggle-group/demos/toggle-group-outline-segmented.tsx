"use client";

import { CaretLeft, CaretRight, Equals } from "@elmeragroup/fuse/icons";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

export function ToggleGroupOutlineSegmented() {
  return (
    <ToggleGroup.Root
      variant="outline"
      spacing={0}
      defaultValue={["center"]}
      aria-label="Segmented alignment">
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
