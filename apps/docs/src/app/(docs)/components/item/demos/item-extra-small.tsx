"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemExtraSmall() {
  return (
    <div className="max-w-md w-full">
      <Item.Root variant="outline" size="xs">
        <Item.Content>
          <Item.Title>Spot</Item.Title>
          <Item.Description>Hourly price with no lock-in.</Item.Description>
        </Item.Content>
      </Item.Root>
    </div>
  );
}
