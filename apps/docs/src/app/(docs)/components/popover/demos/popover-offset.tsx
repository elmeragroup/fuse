"use client";

import { Popover } from "@elmeragroup/fuse/popover";

export function PopoverOffset() {
  return (
    <Popover.Root>
      <Popover.Trigger>Delivery window</Popover.Trigger>
      <Popover.Content sideOffset={12} alignOffset={8}>
        <Popover.Header>
          <Popover.Title>Delivery window</Popover.Title>
          <Popover.Description>Orders placed before 14:00 ship the same day.</Popover.Description>
        </Popover.Header>
      </Popover.Content>
    </Popover.Root>
  );
}
