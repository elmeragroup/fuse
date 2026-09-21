"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemGroupDemo() {
  return (
    <Item.Group>
      <Item.Root>
        <Item.Title>Default</Item.Title>
      </Item.Root>
      <Item.Separator />
      <Item.Root size="sm">
        <Item.Title>Small</Item.Title>
      </Item.Root>
      <Item.Root size="xs">
        <Item.Title>Extra small</Item.Title>
      </Item.Root>
    </Item.Group>
  );
}
