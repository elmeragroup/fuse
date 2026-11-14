"use client";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipDelay() {
  return (
    <Tooltip.Provider delay={400}>
      <div className="flex gap-4">
        <Tooltip.Root>
          <Tooltip.Trigger>Grid rent</Tooltip.Trigger>
          <Tooltip.Content>The fee for using the electricity grid</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>Energy fee</Tooltip.Trigger>
          <Tooltip.Content>The tax on each kWh you use</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </Tooltip.Provider>
  );
}
