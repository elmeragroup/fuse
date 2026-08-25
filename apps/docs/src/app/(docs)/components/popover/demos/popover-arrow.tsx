"use client";

import { Button } from "@elmeragroup/ui/button";
import { Popover } from "@elmeragroup/ui/popover";

const sides = ["top", "bottom", "left", "right"] as const;

export function PopoverArrow() {
  return (
    <div className="flex flex-wrap gap-2">
      {sides.map((side) => (
        <Popover.Root key={side}>
          <Popover.Trigger render={<Button variant="outline" />}>{side}</Popover.Trigger>
          <Popover.Content showArrow side={side}>
            <Popover.Header>
              <Popover.Title>Dimensions</Popover.Title>
              <Popover.Description>The arrow follows {side} placement.</Popover.Description>
            </Popover.Header>
          </Popover.Content>
        </Popover.Root>
      ))}
    </div>
  );
}
