"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemSizes() {
  return (
    <div className="flex flex-col gap-3">
      <Item.Root size="default">
        <Item.Title>Default</Item.Title>
      </Item.Root>
      <Item.Root size="sm">
        <Item.Title>Small</Item.Title>
      </Item.Root>
      <Item.Root size="xs">
        <Item.Title>Extra small</Item.Title>
      </Item.Root>
    </div>
  );
}
