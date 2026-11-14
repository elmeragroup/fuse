"use client";

import { useState } from "react";

import { Popover } from "@elmeragroup/fuse/popover";

export function PopoverControlled() {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>Delivery window</Popover.Trigger>
      <Popover.Content>
        <Popover.Header>
          <Popover.Title>Delivery window</Popover.Title>
          <Popover.Description>Orders placed before 14:00 ship the same day.</Popover.Description>
        </Popover.Header>
        <button type="button" onClick={() => setOpen(false)}>
          Got it
        </button>
      </Popover.Content>
    </Popover.Root>
  );
}
