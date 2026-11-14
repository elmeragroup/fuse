"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Popover } from "@elmeragroup/fuse/popover";

export function PopoverDemo() {
  return (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="outline" />}>Delivery window</Popover.Trigger>
      <Popover.Content>
        <Popover.Header>
          <Popover.Title>Delivery window</Popover.Title>
          <Popover.Description>Orders placed before 14:00 ship the same day.</Popover.Description>
        </Popover.Header>
      </Popover.Content>
    </Popover.Root>
  );
}
