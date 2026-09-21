"use client";

import { Item } from "@elmeragroup/fuse/item";

export function ItemAsLink() {
  return (
    <Item.Root variant="outline" render={<a href="#order" />}>
      <Item.Content>
        <Item.Title>Open order</Item.Title>
        <Item.Description>Continue where you left off.</Item.Description>
      </Item.Content>
    </Item.Root>
  );
}
