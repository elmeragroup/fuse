"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Popover } from "@elmeragroup/fuse/popover";

export function PopoverControlled() {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger render={<Button variant="outline" />}>Delivery window</Popover.Trigger>
      <Popover.Content>
        <Popover.Header>
          <Popover.Title>Delivery window</Popover.Title>
          <Popover.Description>Orders placed before 14:00 ship the same day.</Popover.Description>
        </Popover.Header>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Got it
        </Button>
      </Popover.Content>
    </Popover.Root>
  );
}
