"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipTrackCursorY() {
  return (
    <div className="rounded-md border border-border">
      <Tooltip.Root trackCursorAxis="y">
        <Tooltip.Trigger className="h-48 w-32">Grid rent</Tooltip.Trigger>
        <Tooltip.Content>The fee for using the electricity grid</Tooltip.Content>
      </Tooltip.Root>
    </div>
  );
}
