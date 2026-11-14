"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipRootDelay() {
  return (
    <Tooltip.Root delay={800}>
      <Tooltip.Trigger>Grid rent</Tooltip.Trigger>
      <Tooltip.Content>The fee for using the electricity grid</Tooltip.Content>
    </Tooltip.Root>
  );
}
