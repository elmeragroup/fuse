"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemSeparator() {
  return (
    <div className="max-w-md w-full">
      <Item.Group>
        <Item.Root>
          <Item.Title>Profile</Item.Title>
        </Item.Root>
        <Item.Separator />
        <Item.Root>
          <Item.Title>Invoices</Item.Title>
        </Item.Root>
      </Item.Group>
    </div>
  );
}
