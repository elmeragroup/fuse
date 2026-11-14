"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipTrackCursorX() {
  return (
    <div className="rounded-md border border-border">
      <Tooltip.Root trackCursorAxis="x">
        <Tooltip.Trigger className="h-16 w-96">Grid rent</Tooltip.Trigger>
        <Tooltip.Content>The fee for using the electricity grid</Tooltip.Content>
      </Tooltip.Root>
    </div>
  );
}
