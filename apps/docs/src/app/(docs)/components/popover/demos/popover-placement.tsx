"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Popover } from "@elmeragroup/fuse/popover";

const placements = [
  { label: "start", align: "start", sideOffset: 4, alignOffset: 0 },
  { label: "center", align: "center", sideOffset: 4, alignOffset: 0 },
  { label: "end", align: "end", sideOffset: 4, alignOffset: 0 },
  { label: "offset", align: "start", sideOffset: 12, alignOffset: 8 },
] as const;

export function PopoverPlacement() {
  return (
    <div className="flex flex-wrap gap-2">
      {placements.map((placement) => (
        <Popover.Root key={placement.label}>
          <Popover.Trigger render={<Button variant="outline" />}>{placement.label}</Popover.Trigger>
          <Popover.Content
            align={placement.align}
            sideOffset={placement.sideOffset}
            alignOffset={placement.alignOffset}>
            <Popover.Header>
              <Popover.Title>Dimensions</Popover.Title>
              <Popover.Description>
                align {placement.align}, sideOffset {placement.sideOffset}, alignOffset{" "}
                {placement.alignOffset}.
              </Popover.Description>
            </Popover.Header>
          </Popover.Content>
        </Popover.Root>
      ))}
    </div>
  );
}
