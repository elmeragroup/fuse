"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipAlignStart() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<Button variant="outline" />}>Grid rent</Tooltip.Trigger>
      <Tooltip.Content align="start">The fee for using the electricity grid</Tooltip.Content>
    </Tooltip.Root>
  );
}
