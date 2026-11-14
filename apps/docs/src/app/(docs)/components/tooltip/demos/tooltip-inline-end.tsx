"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipInlineEnd() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger>Grid rent</Tooltip.Trigger>
      <Tooltip.Content side="inline-end">The fee for using the electricity grid</Tooltip.Content>
    </Tooltip.Root>
  );
}
