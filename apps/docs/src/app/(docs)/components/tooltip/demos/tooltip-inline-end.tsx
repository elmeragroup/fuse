"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipInlineEnd() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<Button variant="outline" />}>Grid rent</Tooltip.Trigger>
      <Tooltip.Content side="inline-end">The fee for using the electricity grid</Tooltip.Content>
    </Tooltip.Root>
  );
}
