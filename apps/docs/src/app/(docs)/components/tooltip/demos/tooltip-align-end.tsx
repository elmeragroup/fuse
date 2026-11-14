"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipAlignEnd() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger>Grid rent</Tooltip.Trigger>
      <Tooltip.Content align="end">The fee for using the electricity grid</Tooltip.Content>
    </Tooltip.Root>
  );
}
