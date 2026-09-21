"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Popover } from "@elmeragroup/fuse/popover";

export function PopoverControlled() {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger render={<Button variant="outline" />}>Details</Popover.Trigger>
      <Popover.Content>
        <Popover.Header>
          <Popover.Title>Dimensions</Popover.Title>
          <Popover.Description>Set the dimensions for the layer.</Popover.Description>
        </Popover.Header>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Apply
        </Button>
      </Popover.Content>
    </Popover.Root>
  );
}
