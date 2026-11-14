"use client";

import { useState } from "react";

import { Item } from "@elmeragroup/fuse/item";

export function ItemFooterReveal() {
  const [open, setOpen] = useState(false);
  return (
    <div className="max-w-md flex w-full flex-col items-start gap-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide details" : "Show details"}
      </button>
      <Item.Root variant="outline">
        <Item.Content>
          <Item.Title>Spot</Item.Title>
          <Item.Description>Hourly price with no lock-in.</Item.Description>
        </Item.Content>
        <Item.Footer mode={open ? "visible" : "hidden"}>Billed monthly with a fixed markup.</Item.Footer>
      </Item.Root>
    </div>
  );
}
