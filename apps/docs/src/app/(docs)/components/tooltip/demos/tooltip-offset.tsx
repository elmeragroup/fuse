"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipOffset() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<Button variant="outline" />}>Grid rent</Tooltip.Trigger>
      <Tooltip.Content sideOffset={12} alignOffset={8}>
        The fee for using the electricity grid
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
