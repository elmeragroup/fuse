"use client";

import { Button } from "@elmeragroup/ui/button";
import { Tooltip } from "@elmeragroup/ui/tooltip";

const sides = ["top", "right", "bottom", "left"] as const;

export function TooltipSides() {
  return (
    <Tooltip.Provider>
      <div className="flex flex-wrap items-center justify-center gap-8 p-16">
        {sides.map((side) => (
          <Tooltip.Root key={side}>
            <Tooltip.Trigger render={<Button variant="outline" />}>{side}</Tooltip.Trigger>
            <Tooltip.Content side={side}>{side}</Tooltip.Content>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  );
}
