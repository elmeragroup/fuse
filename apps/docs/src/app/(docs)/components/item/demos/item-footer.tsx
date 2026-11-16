"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemFooter() {
  return (
    <div className="max-w-md w-full">
      <Item.Root variant="outline">
        <Item.Content>
          <Item.Title>Spot</Item.Title>
          <Item.Description>Hourly price with no lock-in.</Item.Description>
        </Item.Content>
        <Item.Footer>Billed monthly with a fixed markup.</Item.Footer>
      </Item.Root>
    </div>
  );
}
