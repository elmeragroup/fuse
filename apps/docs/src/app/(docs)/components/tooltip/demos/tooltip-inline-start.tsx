"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipInlineStart() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<Button variant="outline" />}>Grid rent</Tooltip.Trigger>
      <Tooltip.Content side="inline-start">The fee for using the electricity grid</Tooltip.Content>
    </Tooltip.Root>
  );
}
