"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipBottom() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger>Grid rent</Tooltip.Trigger>
      <Tooltip.Content side="bottom">The fee for using the electricity grid</Tooltip.Content>
    </Tooltip.Root>
  );
}
