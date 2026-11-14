"use client";

import { Popover } from "@elmeragroup/fuse/popover";

export function PopoverTop() {
  return (
    <Popover.Root>
      <Popover.Trigger>Delivery window</Popover.Trigger>
      <Popover.Content side="top">
        <Popover.Header>
          <Popover.Title>Delivery window</Popover.Title>
          <Popover.Description>Orders placed before 14:00 ship the same day.</Popover.Description>
        </Popover.Header>
      </Popover.Content>
    </Popover.Root>
  );
}
