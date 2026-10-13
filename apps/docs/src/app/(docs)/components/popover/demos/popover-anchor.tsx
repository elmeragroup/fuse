"use client";

import { useRef, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Popover } from "@elmeragroup/fuse/popover";

export function PopoverAnchor() {
  const [open, setOpen] = useState(false);
  const address = useRef<HTMLParagraphElement>(null);

  return (
    <div className="flex flex-col items-start gap-3">
      <p ref={address} className="text-sm rounded-md border border-border px-3 py-2">
        Storgata 1, 0155 Oslo
      </p>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Why this address?
      </Button>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Content anchor={address} side="right" initialFocus={false}>
          <Popover.Header>
            <Popover.Title>Delivery address</Popover.Title>
            <Popover.Description>
              It is the address on your last order. Change it at checkout.
            </Popover.Description>
          </Popover.Header>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
