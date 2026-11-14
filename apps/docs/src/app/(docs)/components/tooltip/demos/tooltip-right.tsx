"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipRight() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger>Grid rent</Tooltip.Trigger>
      <Tooltip.Content side="right">The fee for using the electricity grid</Tooltip.Content>
    </Tooltip.Root>
  );
}
