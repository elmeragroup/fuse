"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemGroup() {
  return (
    <div className="max-w-md w-full">
      <Item.Group>
        <Item.Root variant="outline">
          <Item.Title>Profile</Item.Title>
        </Item.Root>
        <Item.Root variant="outline">
          <Item.Title>Invoices</Item.Title>
        </Item.Root>
        <Item.Root variant="outline">
          <Item.Title>Notifications</Item.Title>
        </Item.Root>
      </Item.Group>
    </div>
  );
}
