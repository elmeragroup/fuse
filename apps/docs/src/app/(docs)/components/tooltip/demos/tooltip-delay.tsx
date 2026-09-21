"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipDelay() {
  return (
    <Tooltip.Provider delay={400}>
      <div className="flex flex-wrap gap-2">
        <Tooltip.Root>
          <Tooltip.Trigger render={<Button variant="outline" />}>Grouped A</Tooltip.Trigger>
          <Tooltip.Content>Waits for the provider delay, then skip-delay to B</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger render={<Button variant="outline" />}>Grouped B</Tooltip.Trigger>
          <Tooltip.Content>Opens without re-waiting after A</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root delay={800}>
          <Tooltip.Trigger render={<Button variant="outline" />}>Scoped override</Tooltip.Trigger>
          <Tooltip.Content>Own provider group — does not inherit skip-delay</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </Tooltip.Provider>
  );
}
