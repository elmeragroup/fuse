"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Popover } from "@elmeragroup/fuse/popover";

export function PopoverAlignStart() {
  return (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="outline" />}>Delivery window</Popover.Trigger>
      <Popover.Content align="start">
        <Popover.Header>
          <Popover.Title>Delivery window</Popover.Title>
          <Popover.Description>Orders placed before 14:00 ship the same day.</Popover.Description>
        </Popover.Header>
      </Popover.Content>
    </Popover.Root>
  );
}
