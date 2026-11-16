"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Popover } from "@elmeragroup/fuse/popover";

export function PopoverRight() {
  return (
    <div className="flex w-full justify-start">
      <Popover.Root>
        <Popover.Trigger render={<Button variant="outline" />}>Delivery window</Popover.Trigger>
        <Popover.Content side="right">
          <Popover.Header>
            <Popover.Title>Delivery window</Popover.Title>
            <Popover.Description>Orders placed before 14:00 ship the same day.</Popover.Description>
          </Popover.Header>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
