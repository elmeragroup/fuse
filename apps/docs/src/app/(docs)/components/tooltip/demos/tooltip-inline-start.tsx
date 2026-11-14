"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipInlineStart() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger>Grid rent</Tooltip.Trigger>
      <Tooltip.Content side="inline-start">The fee for using the electricity grid</Tooltip.Content>
    </Tooltip.Root>
  );
}
