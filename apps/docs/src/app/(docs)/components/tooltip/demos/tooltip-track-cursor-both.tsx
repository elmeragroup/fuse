"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipTrackCursorBoth() {
  return (
    <div className="rounded-md border border-border">
      <Tooltip.Root trackCursorAxis="both">
        <Tooltip.Trigger className="h-40 w-80">Grid rent</Tooltip.Trigger>
        <Tooltip.Content>The fee for using the electricity grid</Tooltip.Content>
      </Tooltip.Root>
    </div>
  );
}
