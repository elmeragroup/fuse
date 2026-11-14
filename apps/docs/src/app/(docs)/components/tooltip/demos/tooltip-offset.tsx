"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipOffset() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger>Grid rent</Tooltip.Trigger>
      <Tooltip.Content sideOffset={12} alignOffset={8}>
        The fee for using the electricity grid
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
